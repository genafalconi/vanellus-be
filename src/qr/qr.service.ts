import { Inject, Injectable } from '@nestjs/common';
import * as qrcode from 'qrcode';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateTicketsDto, TicketSendDto } from 'src/data/ticket.dto';
import { Client } from 'src/schema/client.schema';
import { Ticket } from 'src/schema/ticket.schema';
import { Voucher } from 'src/schema/voucher.schema';
import { sendEmail } from 'src/helpers/node-mailer';
import { FROM_EMAIL, SubjectDto } from 'src/data/client.dto';
import { ComprobanteService } from 'src/comprobante/comprobante.service';

@Injectable()
export class QrService {
  private validationCache = new Map<string, { result: any; timestamp: number }>();
  private validationHistory = new Map<string, { result: any; timestamp: number }>();
  private cacheTTL = 2000;

  constructor(
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<Ticket>,
    @InjectModel(Client.name)
    private readonly clientModel: Model<Client>,
    @InjectModel(Voucher.name)
    private readonly voucherModel: Model<Voucher>,
    @Inject(ComprobanteService)
    private readonly comprobanteService: ComprobanteService,
  ) { }

  // New method: Processes all clients in a voucher and sends one email
  async createQrInvitationForVoucher(payload: CreateTicketsDto): Promise<Client[] | boolean> {
    try {
      const updatedClients: Client[] = [];
      const qrInfos: string[] = [];

      for (const clientData of payload.clients) {
        // Retrieve the client from the database.
        const client = await this.clientModel.findById(clientData._id);
        if (!client) continue;

        // Create a new Ticket (with empty URL initially and not yet sent).
        const ticketClient = new this.ticketModel({
          url: '',
          used: false,
          active: true,
          sent: false,
        });

        // Prepare data for QR code.
        const ticketData = JSON.stringify({
          ticketId: ticketClient._id,
          client: client.fullName,
        });

        // Generate the QR code.
        const qrDataUrl = await this.generateQrCode(ticketData);
        const buffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
        // Create a file-like object that matches Express.Multer.File interface.
        const fileQr = {
          buffer,
          originalname: `qr${ticketClient._id}.png`,
        } as Express.Multer.File;

        // Upload the QR image to Cloudinary.
        const uploadResult = await this.comprobanteService.uploadQrImage(fileQr);
        if (!uploadResult.success) {
          throw new Error("Failed to upload QR image to Cloudinary");
        }
        const qrUrl = uploadResult.fileUrl;

        // Set the uploaded URL on the Ticket.
        ticketClient.url = qrUrl;

        // Update the client to reference the new ticket and create the ticket document in parallel.
        const [clientUpdate] = await Promise.all([
          this.clientModel.findByIdAndUpdate(
            new Types.ObjectId(client._id as string),
            { $set: { ticket: new Types.ObjectId(ticketClient._id as string) } },
            { new: true },
          ).populate({ path: 'ticket', model: 'Ticket' }),
          this.ticketModel.create(ticketClient),
        ]);

        updatedClients.push(clientUpdate);

        // Accumulate information for the email.
        qrInfos.push(`
          <p><strong>Nombre:</strong> ${client.fullName} <br/>
          <strong>DNI:</strong> ${client.dni}</p>
          <img style="width:150px; object-fit:cover;" src="${qrUrl}" alt="QR Code" />
        `);
      }

      // Prepare the email content. (Using HTML for better formatting.)
      const emailHtml = `
        <p>Te mandamos tu entrada para el evento.</p>
        <p><strong>ENVUELTO</strong></p>
        <p>Para visualizar la entrada, permite descargar el contenido bloqueado.</p>
        ${qrInfos.join('<hr/>')}
        <br/>
        <img style="width:200px; object-fit:cover;" src="https://res.cloudinary.com/dxmi0j9yh/image/upload/v1740784174/FlyerLogoCrop_lzzufk.png" alt="Flyer" />
      `;

      const dataToEmail = {
        from: FROM_EMAIL,
        to: payload.email,
        subject: SubjectDto.AUTH,
        text: emailHtml, // using HTML content
      };

      // Send email
      const emailResult = await sendEmail(dataToEmail);

      if (emailResult) {
        await Promise.all([
          this.ticketModel.updateMany(
            { _id: { $in: updatedClients.map(client => new Types.ObjectId(client.ticket._id as string)) } },
            { $set: { sent: true } }
          ),
          this.voucherModel.updateOne(
            { _id: new Types.ObjectId(payload.voucherId) },
            { sent: true },
          ),
        ]);
      } else {
        await Promise.all([
          this.ticketModel.deleteMany({
            _id: { $in: updatedClients.map(client => new Types.ObjectId(client.ticket._id as string)) }
          }),
          this.clientModel.updateMany(
            { _id: { $in: updatedClients.map(client => new Types.ObjectId(client._id as string)) } },
            { $set: { ticket: null } }
          )
        ]);
        return false;
      }

      return updatedClients;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  async sendQrCodeToMail(voucherEmail: string, qrUrl: string): Promise<boolean> {
    const dataToEmail = {
      from: FROM_EMAIL,
      to: voucherEmail,
      subject: SubjectDto.AUTH,
      text: `Te mandamos tu entrada para el evento.
        ENVUELTO
        Para visualizar la entrada, permite descargar el contenido bloqueado!!
        Tu código QR: ${qrUrl}
        <img style="width: 200px; object-fit: cover;" src="https://res.cloudinary.com/dxmi0j9yh/image/upload/v1740784174/FlyerLogoCrop_lzzufk.png" alt="Flyer" />`,
    };
    return await sendEmail(dataToEmail);
  }

  async generateQrCode(data: string): Promise<string> {
    try {
      return await qrcode.toDataURL(data, { errorCorrectionLevel: 'H' });
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  }

  parseClientTickets(ticketsToSend: Array<string>): Array<string> {
    return ticketsToSend.map(elem => `${elem}\n`);
  }

  getTicketData(clients: Array<Client>): Array<string> {
    const ticketsToSend: Array<string> = [];
    for (const cli of clients) {
      const nameAndQrTicket = `Nombre: ${cli.fullName}, DNI: ${cli.dni}
      <img style="width: 150px; object-fit: cover;" src="${cli.ticket?.url}" alt="QRcode" />`;
      ticketsToSend.push(nameAndQrTicket);
    }
    return this.parseClientTickets(ticketsToSend);
  }

  async sendAuthEmail(ticketData: TicketSendDto) {
    const ticketsToSend: Array<string> = this.getTicketData(ticketData.clients);
    const dataToEmail = {
      from: FROM_EMAIL,
      to: ticketData.mailTo,
      subject: SubjectDto.AUTH,
      text: `Te mandamos tu entrada para el evento.
      
        FANTOM 9/12
              
        Para visualizar la entrada, permite descargar el contenido bloqueado!!
        ${ticketsToSend}
              
        <img style="width: 200px; object-fit: cover;" src="YOUR_FLYER_LINK" alt="Flyer" />`,
    };
    return await sendEmail(dataToEmail);
  }

  async sendUnauthEmail(unauthMail: string) {
    const dataToEmail = {
      from: FROM_EMAIL,
      to: unauthMail,
      subject: SubjectDto.UNAUTH,
      text: `Te comunicamos que no cumplis los requisitos de edad para asistir al evento.
        FANTOM 9/12
        Te pedimos que te comuniques con <a href="YOUR_WPP_LINK">Mateo</a> para la devolucion de la plata!!
        <img style="width: 200px; object-fit: cover;" src="YOUR_FLYER_LINK" alt="Flyer" />`,
    };
    return await sendEmail(dataToEmail);
  }

  async validateQrData(data: any): Promise<{ success: boolean, message: string }> {
    // Extract the actual JSON string if data is in the form { "jsonString": "" }
    let jsonStr: string;
    if (typeof data === 'object' && Object.keys(data).length === 1) {
      jsonStr = Object.keys(data)[0];
    } else {
      jsonStr = JSON.stringify(data);
    }

    const key = jsonStr;
    const now = Date.now();

    // Check the validation history first: if it exists, return an error.
    if (this.validationHistory.has(key)) {
      return { success: false, message: "La entrada ya ha sido utilizada" };
    }

    // Check the cache: if it exists and is within the TTL, return an error.
    if (this.validationCache.has(key)) {
      const cacheEntry = this.validationCache.get(key);
      if (cacheEntry && (now - cacheEntry.timestamp) < this.cacheTTL) {
        return { success: false, message: "La entrada ya ha sido utilizada" };
      } else {
        // Remove expired cache entries.
        this.validationCache.delete(key);
      }
    }

    console.log("Validating QR data:", key);
    let resultObj: { ticketId: string, client: string };
    try {
      resultObj = JSON.parse(key);
    } catch (err) {
      console.error("Error parsing QR data:", err);
      return { success: false, message: "Codigo invalido" };
    }

    // Query the database for the ticket.
    const ticket = await this.ticketModel.findOne({
      _id: new Types.ObjectId(resultObj.ticketId)
    });
    if (!ticket) {
      return { success: false, message: "No se encontro la entrada" };
    }

    // If the ticket has already been used...
    if (ticket.used) {
      // Cache this result to prevent further processing of the same QR code.
      this.validationCache.set(key, { result: { used: true }, timestamp: now });
      this.validationHistory.set(key, { result: { used: true }, timestamp: now });
      return { success: false, message: "La entrada ya ha sido utilizada" };
    }

    // Mark the ticket as used in the database.
    await this.ticketModel.updateOne(
      { _id: new Types.ObjectId(resultObj.ticketId) },
      { $set: { used: true } }
    );

    // Save the result in both the cache and history.
    this.validationCache.set(key, { result: { used: true }, timestamp: now });
    this.validationHistory.set(key, { result: { used: true }, timestamp: now });

    return { success: true, message: "Entrada validada correctamente" };
  }

  async regenerateQr(regenerateTickets: CreateTicketsDto): Promise<Client[] | boolean> {
    // 1. Find the clients to regenerate
    const clientIds = regenerateTickets.clients.map((c) => c._id);
    const foundClients = await this.clientModel.find({
      _id: { $in: clientIds },
    });

    // 2. Gather the ticket IDs from those clients
    const ticketIds = foundClients.filter((c) => c.ticket).map((c) => c.ticket._id);

    // 3. Delete the tickets for those IDs
    if (ticketIds.length > 0) {
      await this.ticketModel.deleteMany({ _id: { $in: ticketIds } });
    }

    // (Optional) Remove the ticket reference from the clients
    await this.clientModel.updateMany(
      { _id: { $in: clientIds } },
      { $set: { ticket: null } }
    );

    // 4. Set the voucher’s sent = false
    if (regenerateTickets.voucherId) {
      await this.voucherModel.updateOne(
        { _id: regenerateTickets.voucherId },
        { $set: { sent: false } }
      );
    }

    return await this.createQrInvitationForVoucher(regenerateTickets);
  }
}
