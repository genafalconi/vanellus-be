import { HttpException, HttpStatus, Inject, Injectable, Req, UploadedFile } from '@nestjs/common';
import { diskStorage } from 'multer';
import { tickets } from 'src/data/qrticket';
import { TicketDto } from 'src/data/ticket.dto';
import { v2 as cloudinary } from 'cloudinary';
import * as qrcode from 'qrcode';
import { ClientDataDto, BuyTicketsDataDto, PreventDataDto } from 'src/data/client.dto';
import { Ticket } from 'src/schema/ticket.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Client } from 'src/schema/client.schema';
import { firebaseAuth } from 'src/firebase/firebase.app';
import { Prevent } from 'src/schema/prevent.schema';
import { Voucher } from 'src/schema/voucher.schema';

@Injectable()
export class TicketService {
  constructor(
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<Ticket>,
    @InjectModel(Client.name)
    private readonly clientModel: Model<Client>,
    @InjectModel(Prevent.name)
    private readonly preventModel: Model<Prevent>,
    @InjectModel(Voucher.name)
    private readonly voucherModel: Model<Voucher>,
  ) { }

  async createTicket(ticketsData: BuyTicketsDataDto): Promise<any> {
    const clientSaved: Array<Client> = []
    const parsedClients: Array<ClientDataDto> = ticketsData.clients

    for (let cli of parsedClients) {
      const newClient = new this.clientModel({
        fullName: cli.fullName,
        dni: cli.dni
      });

      const saved = await this.clientModel.create(newClient);
      clientSaved.push(saved._id);
    }
    const newComprobante = new this.voucherModel({
      clients: clientSaved,
      email: ticketsData.email,
      prevent: new Types.ObjectId(ticketsData.prevent),
      total: ticketsData.total,
      url: ticketsData.cloudinaryUrl,
      active: true
    })
    return await this.voucherModel.create(newComprobante)
  }

  async saveFileCloudinary(comprobante: Express.Multer.File): Promise<string> {
    const { buffer } = comprobante;

    const result: any = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({ resource_type: 'auto', folder: 'Vanellus' }, async (error, result) => {
        if (error) {
          reject(error);
        }
        resolve(result);
      }).end(buffer);
    });

    return result?.url;
  }

  async getTickets(prevent: string) {
    return await this.voucherModel.find({ prevent: new Types.ObjectId(prevent) })
      .populate({
        path: 'clients',
        model: 'Client',
      })
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

  async createQrCode(client: Client): Promise<Ticket> {
    // const invitationCode = this.generateInvitationCode(client);

    // const options = { errorCorrectionLevel: 'H' };
    // const qrCodeDataUrl = await this.generateQrCode(invitationCode, options); 

    const ticket = new this.ticketModel({
      url: '',
      used: false,
      active: false,
      sent: false
    })

    const ticketCreated = await this.ticketModel.create(ticket)
    await this.clientModel.findByIdAndUpdate(
      client._id,
      { $set: { ticket: ticketCreated.url } },
      { new: true }
    )

    return ticketCreated
  }

  // generateInvitationCode(client: Client): string {
  //   return `${client.fullName}-${client.email}-${client.dni}`;
  // }

  async generateQrCode(data: string, options: any): Promise<any> {
    try {
      const dataUrl = qrcode.toBuffer(data, options)
      return dataUrl
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  }

  async createPrevent(prevent: PreventDataDto): Promise<Prevent> {
    const preventCreated = new this.preventModel({
      name: prevent.name,
      price: prevent.price,
      active: prevent.active
    });
    return await this.preventModel.create(preventCreated)
  }

  async getPrevents(): Promise<Array<Prevent>> {
    return await this.preventModel.find()
  }
}