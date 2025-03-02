import { Injectable } from '@nestjs/common';
import * as qrcode from 'qrcode';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateTicketsDto, TicketSendDto } from 'src/data/ticket.dto';
import { Client } from 'src/schema/client.schema';
import { Ticket } from 'src/schema/ticket.schema';
import { sendEmail } from 'src/helpers/node-mailer';
import {
  FROM_EMAIL,
  SubjectDto,
} from 'src/data/client.dto';

@Injectable()
export class QrService {
  constructor(
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<Ticket>,
    @InjectModel(Client.name)
    private readonly clientModel: Model<Client>,
  ) { }

  async createQrCode(clientId: string): Promise<Client> {
    const client = await this.clientModel.findById(clientId).populate({ path: 'ticket', model: 'Ticket' });
    return await this.generateInvitationCode(client);
  }

  async generateInvitationCode(cli: Client): Promise<Client> {
    const ticketClient = new this.ticketModel({
      url: '',
      used: false,
      active: true,
      sent: true,
    });

    const ticketData = JSON.stringify({
      ticketId: ticketClient._id,
      client: cli.fullName,
      dni: cli.dni,
      clientId: cli._id,
    });
    const qrUrl = await this.generateQrCode(ticketData);
    ticketClient.url = qrUrl;

    const [clientUpdate] = await Promise.all([
      this.clientModel.findByIdAndUpdate(
        new Types.ObjectId(cli._id as string),
        { $set: { ticket: new Types.ObjectId(ticketClient._id as string) } },
        { new: true },
      ).populate({ path: 'ticket', model: 'Ticket' }),
      this.ticketModel.create(ticketClient),
    ]);

    return clientUpdate
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
      text: `Te mandamos tu entrada para el evento. \n
        FANTOM 9/12 \n
        Para visualizar la entrada, permiti descargar el contenido bloqueado!!\n
        ${ticketsToSend}\n
        <img style="width: 200px; object-fit: cover;"  src="YOUR_FLYER_LINK" alt="Flyer" />`,
    };
    return await sendEmail(dataToEmail);
  }

  async sendUnauthEmail(unauthMail: string) {
    const dataToEmail = {
      from: FROM_EMAIL,
      to: unauthMail,
      subject: SubjectDto.UNAUTH,
      text: `Te comunicamos que no cumplis los requisitos de edad para asistir al evento.\n
        FANTOM 9/12 \n
        Te pedimos que te comuniques con <a href="YOUR_WPP_LINK">Mateo</a> para la devolucion de la plata!!\n
        <img style="width: 200px; object-fit: cover;" src="YOUR_FLYER_LINK" alt="Flyer" />`,
    };
    return await sendEmail(dataToEmail);
  }

  async validateQrData(data: any) {
    console.log(data)
  }
}
