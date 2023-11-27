import { Inject, Injectable, Req, UploadedFile } from '@nestjs/common';
import { diskStorage } from 'multer';
import { tickets } from 'src/data/qrticket';
import { TicketDto } from 'src/data/ticket.dto';
import * as qrcode from 'qrcode';
import { ClientDto } from 'src/data/client.dto';
import { Ticket } from 'src/schema/ticket.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Client } from 'src/schema/client.schema';

@Injectable()
export class TicketService {
  constructor(
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<Ticket>,
    @InjectModel(Client.name)
    private readonly clientModel: Model<Client>,
  ) { }

  async createTicket(client: ClientDto): Promise<Client> {
    const newClient = new this.clientModel({
      fullName: client.fullName,
      email: client.email,
      dni: client.dni,
      comprobante: client.cloudinaryUrl,
      ticket: null
    });
    return await this.clientModel.create(newClient);
  }

  async getTickets() {
    return await this.clientModel.find()
  }
}

// const dataToEncode = `${client.email}${client.dni}${client.fullName}`;

// try {
//   // Generate QR code URL asynchronously
//   const qrUrl = await qrcode.toDataURL(dataToEncode, { errorCorrectionLevel: 'L' });
//   // Update the ticket with the generated QR code URL
//   newTicket.ticketUrl = qrUrl;
// } catch (error) {
//   console.error('Error generating QR code:', error.message);
// }

// tickets.push(newTicket)