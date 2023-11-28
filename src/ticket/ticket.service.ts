import { HttpException, HttpStatus, Inject, Injectable, Req, UploadedFile } from '@nestjs/common';
import { diskStorage } from 'multer';
import { tickets } from 'src/data/qrticket';
import { TicketDto } from 'src/data/ticket.dto';
import * as qrcode from 'qrcode';
import { ClientDataDto, ClientDto } from 'src/data/client.dto';
import { Ticket } from 'src/schema/ticket.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Client } from 'src/schema/client.schema';
import { firebaseAuth } from 'src/firebase/firebase.app';

@Injectable()
export class TicketService {
  constructor(
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<Ticket>,
    @InjectModel(Client.name)
    private readonly clientModel: Model<Client>,
    private readonly invitations: Map<string, string> = new Map()
  ) { }

  async createTicket(client: ClientDto): Promise<Array<Client>> {
    const clientSaved: Array<Client> = []
    const parsedClients: Array<ClientDataDto> = JSON.parse(client.clients)

    for (let cli of parsedClients) {
      const newClient = new this.clientModel({
        email: client.email,
        fullName: cli.fullName,
        dni: cli.dni,
        comprobante: client.cloudinaryUrl,
        ticket: null
      });

      const saved = await this.clientModel.create(newClient);
      clientSaved.push(saved);
    }
    return clientSaved
  }

  async getTickets() {
    return await this.clientModel.find()
  }

  async verifyToken(token: string): Promise<boolean> {
    try {
      token = token.split(' ')[1];
      if (token !== 'null') {
        const tokenValidation = await firebaseAuth.verifyIdToken(token);
        return !!tokenValidation;
      } else {
        return false;
      }
    } catch (error) {
      throw new HttpException(`Failed to verify token: ${error.message}`, HttpStatus.UNAUTHORIZED);
    }
  }

  async createQrCode(clientName: string): Promise<string> {
    const invitationCode = this.generateInvitationCode(clientName);
    this.invitations.set(invitationCode, clientName);
    return invitationCode;
  }

  generateInvitationCode(clientName: string): string {
    return `${clientName}-${Math.random().toString(36).substring(7)}`;
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