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
import MercadoPagoConfig, { Payment, Preference } from 'mercadopago';

@Injectable()
export class QrService {
  private validationCache = new Map<string, { result: any; timestamp: number }>();
  private validationHistory = new Map<string, { result: any; timestamp: number }>();
  private cacheTTL = 2000;
  private client: MercadoPagoConfig;

  constructor(
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<Ticket>,
    @InjectModel(Client.name)
    private readonly clientModel: Model<Client>,
    @InjectModel(Voucher.name)
    private readonly voucherModel: Model<Voucher>,
    @Inject(ComprobanteService)
    private readonly comprobanteService: ComprobanteService,
  ) {
    this.client = new MercadoPagoConfig({ accessToken: 'TEST-1257158260921955-030314-f2bfa12212d7a4901e43002e8468b5bc-142770605', options: { timeout: 5000 } });
  }

  // New method: Processes all clients in a voucher and sends one email
  async createQrInvitationForVoucher(payload: CreateTicketsDto): Promise<Client[]> {
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
      ])
    }

    return updatedClients
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

    // If the key exists in the history (cache), return failure.
    if (this.validationCache.has(key)) {
      return { success: false, message: "La entrada ya ha sido utilizada" };
    }

    console.log("Validating QR data:", key);

    let resultObj: { ticketId: string, client: string };
    try {
      resultObj = JSON.parse(key);
    } catch (err) {
      console.error("Error parsing QR data:", err);
      return { success: false, message: "Codigo invalido" };
    }

    // Check if the ticket exists and if it has been used.
    const ticket = await this.ticketModel.findOne({
      _id: new Types.ObjectId(resultObj.ticketId)
    });
    if (!ticket) {
      return { success: false, message: "No se encontro la entrada" };
    }
    if (ticket.used) {
      // Cache this result to prevent further processing of the same QR.
      this.validationCache.set(key, { result: { used: true }, timestamp: now });
      return { success: false, message: "La entrada ya ha sido utilizada" };
    }

    // Mark the ticket as used.
    await this.ticketModel.updateOne(
      { _id: new Types.ObjectId(resultObj.ticketId) },
      { $set: { used: true } }
    );

    // Cache the successful validation to prevent duplicate validations.
    this.validationCache.set(key, { result: { used: true }, timestamp: now });

    return { success: true, message: "Entrada validada correctamente" };
  }


  async createPaymentLink(ticket: Ticket): Promise<string> {
    const preference = new Preference(this.client);

    const preferenceData = {
      items: [
        {
          id: ticket._id as string,
          title: 'Early Birds',
          quantity: 1,
          currency_id: 'ARS',
          unit_price: 21000.0,
        },
      ],
      back_urls: {
        success: 'https://envuelto-be-116049592292.southamerica-east1.run.app/webhook/success',
        failure: 'https://envuelto-be-116049592292.southamerica-east1.run.app/webhook/failure',
        pending: 'https://envuelto-be-116049592292.southamerica-east1.run.app/webhook/pending',
      },
      auto_return: 'approved',
    };

    try {
      const response = await preference.create({ body: preferenceData });
      return response.init_point;
    } catch (error) {
      console.error('Error creating payment link:', error);
      throw new Error('Failed to create payment link');
    }
  }
}
