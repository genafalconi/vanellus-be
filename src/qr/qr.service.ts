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
      const attachments: { filename: string; path: string; cid: string }[] = [];

      for (const clientData of payload.clients) {
        const client = await this.clientModel.findById(clientData._id);
        if (!client) continue;

        const ticketClient = new this.ticketModel({
          url: '',
          used: false,
          active: true,
          sent: true,
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

        // Generate a unique CID for this QR image.
        const qrCid = `qrImage_${ticketClient._id}`;

        // Push the QR image as an inline attachment.
        attachments.push({
          filename: `qr${ticketClient._id}.png`,
          path: qrUrl, // Cloudinary URL
          cid: qrCid,
        });

        // Accumulate information for the email, referencing the inline image via its CID.
        qrInfos.push(`
          <p><strong>Nombre:</strong> ${client.fullName} <br/>
          <strong>DNI:</strong> ${client.dni}</p>
          <img style="width:150px; object-fit:cover;" src="cid:${qrCid}" alt="QR Code" /><br/>
          <a href="${qrUrl}" target="_blank">Si no ves el código QR, haz clic aquí para abrirlo en otra pestaña</a>
        `);
      }

      // Prepare the email content. (Using HTML for better formatting.)
      const emailHtml = `
        <p>Te mandamos tu entrada para el evento.</p>
        <p><strong>ENVUELTO</strong></p>
        <p>Para visualizar la entrada, permite descargar el contenido bloqueado.</p>
        ${qrInfos.join('<hr/>')}
        <br/>
        <br/>
        <img style="width:200px; object-fit:cover;" src="https://res.cloudinary.com/dxmi0j9yh/image/upload/v1740784174/FlyerLogoCrop_lzzufk.png" alt="Flyer" />
      `;

      const dataToEmail = {
        from: FROM_EMAIL,
        to: payload.email,
        subject: SubjectDto.AUTH,
        text: emailHtml,
        attachments
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
      attachments: []
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
      attachments: []
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
      attachments: []
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

    const now = Date.now();
    const key = jsonStr;
    console.log("Validating QR data:", key);
    let resultObj: { ticketId: string, client: string };
    try {
      resultObj = JSON.parse(key);
    } catch (err) {
      console.error("Error parsing QR data:", err);
      return { success: false, message: "Codigo invalido" };
    }

    const { ticketId } = resultObj;

    // Check the validation history first: if it exists, return an error.
    if (this.validationHistory.has(ticketId)) {
      return { success: false, message: "La entrada ya ha sido utilizada" };
    }

    // Check the cache: if it exists and is within the TTL, return an error.
    if (this.validationCache.has(ticketId)) {
      const cacheEntry = this.validationCache.get(ticketId);
      if (cacheEntry && (now - cacheEntry.timestamp) < this.cacheTTL) {
        return { success: false, message: "La entrada ya ha sido utilizada" };
      } else {
        // Remove expired cache entries.
        this.validationCache.delete(ticketId);
      }
    }

    // Query the database for the ticket.
    const ticket = await this.ticketModel.findOne({
      _id: new Types.ObjectId(ticketId)
    });
    if (!ticket) {
      return { success: false, message: "No se encontro la entrada" };
    }

    // If the ticket has already been used...
    if (ticket.used) {
      // Cache this result to prevent further processing of the same QR code.
      this.validationCache.set(ticketId, { result: { used: true }, timestamp: now });
      this.validationHistory.set(ticketId, { result: { used: true }, timestamp: now });
      return { success: false, message: "La entrada ya ha sido utilizada" };
    }

    // Mark the ticket as used in the database.
    await this.ticketModel.updateOne(
      { _id: new Types.ObjectId(ticketId) },
      { $set: { used: true } }
    );

    // Save the result in both the cache and history.
    this.validationCache.set(ticketId, { result: { used: true }, timestamp: now });
    this.validationHistory.set(ticketId, { result: { used: true }, timestamp: now });

    return { success: true, message: "Entrada validada correctamente" };
  }

  async regenerateQr(dto: CreateTicketsDto): Promise<Client[] | boolean> {
    // Find the voucher by voucherId and populate its clients (with ticket if needed)
    const foundVoucher = await this.voucherModel.findOne({
      _id: new Types.ObjectId(dto.voucherId)
    }).populate({ path: 'clients', model: 'Client', populate: { path: 'ticket', model: 'Ticket' } });

    if (!foundVoucher) {
      return false;
    }

    // Get the ticket IDs from clients that actually have a ticket
    const ticketIds = foundVoucher.clients
      .filter(client => client.ticket)
      .map(client => new Types.ObjectId(client.ticket._id as string));

    // Delete all tickets with these IDs
    if (ticketIds.length) {
      await this.ticketModel.deleteMany({ _id: { $in: ticketIds } });
    }

    // Remove the ticket reference from these clients
    const clientIds = foundVoucher.clients.map(client => new Types.ObjectId(client._id as string));
    await this.clientModel.updateMany(
      { _id: { $in: clientIds } },
      { $set: { ticket: null } }
    );

    // Generate new QR invitations
    return await this.createQrInvitationForVoucher(dto);
  }

}