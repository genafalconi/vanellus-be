import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as qrcode from 'qrcode';
import {
  ClientDataDto,
  BuyTicketsDataDto,
  PreventDataDto,
  PreventTotalsDto,
  MailDataDto,
  FROM_EMAIL,
  SubjectDto,
  FlyerLink,
  WppLink,
} from 'src/data/client.dto';
import { Ticket } from 'src/schema/ticket.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Client } from 'src/schema/client.schema';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Prevent } from 'src/schema/prevent.schema';
import { Voucher } from 'src/schema/voucher.schema';
import { sendEmail } from 'src/helpers/node-mailer';
import { CreateTicketsDto, TicketSendDto } from 'src/data/ticket.dto';
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { google, sheets_v4 } from 'googleapis';
import { LoginDto, SecurityDto } from 'src/data/login.dto';
import { firebaseAuth, firebaseClientAuth } from 'src/firebase/firebase.app';
import { auth, OAuth2Client } from 'google-auth-library';

@Injectable()
export class TicketService {
  private oAuth2Client: OAuth2Client;
  private sheets: any;

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

  async createTicket(ticketsData: BuyTicketsDataDto): Promise<Voucher> {
    const clientSaved: Array<Client> = [];
    const parsedClients: Array<ClientDataDto> = ticketsData.clients;
    // const prevent = await this.preventModel.findById(new Types.ObjectId(ticketsData.prevent));

    // if (prevent.active) {
    for (const cli of parsedClients) {
      const newClient = new this.clientModel({
        fullName: cli.fullName,
        dni: cli.dni,
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
      active: true,
    });
    const values = parsedClients.map(cli => [
      cli.fullName,
      newComprobante.email,
      newComprobante.url,
      parsedClients.length,
      '',
    ]);
    const resource = { values };
    await this.appendGoogleSheet(resource);

    return await this.voucherModel.create(newComprobante);
    // } else {
    //   throw new HttpException('La preventa esta vencida', HttpStatus.BAD_REQUEST)
    // }
  }

  async getTickets(prevent: string): Promise<Array<Voucher>> {
    return await this.voucherModel
      .find({ prevent: new Types.ObjectId(prevent) })
      .populate({
        path: 'clients',
        model: 'Client',
        // populate: {
        //   path: 'ticket',
        //   model: 'Ticket'
        // }
      });
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
    } catch (error: any) {
      throw new HttpException(
        `Failed to verify token: ${error.message}`,
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async createQrCode(ticketsData: CreateTicketsDto): Promise<Array<Client>> {
    const ticketsToSend = await this.generateInvitationCode(
      ticketsData.clients,
    );
    // await this.sendAuthEmail({ mailTo: ticketsData.email, clients: ticketsToSend })
    return ticketsToSend;
  }

  async sendEmails(): Promise<any> {
    const vouchers = await this.voucherModel.find();
    const maxIterations = 300;
    const startIndex = 0;

    for (const vou of vouchers.slice(startIndex, maxIterations)) {
      const ticketsToSend = await this.generateInvitationCode(vou.clients);
      await this.sendAuthEmail({ mailTo: vou.email, clients: ticketsToSend });
    }

    return 'Mandados';
  }

  async generateExcelFile(): Promise<string> {
    const vouchers = await this.voucherModel.find().populate({
      path: 'clients',
      model: 'Client',
    });

    const excelData = [];

    for (const vou of vouchers) {
      for (const cli of vou.clients) {
        if (!cli.ticket) {
          const addToExcel = {
            nombre: cli.fullName,
            email: vou.email.toLowerCase(),
            comprobante: vou.url,
            cantidad: vou.clients.length,
            checkeado: '',
          };
          excelData.push(addToExcel);
        }
      }
    }

    const flatData = excelData.flat();

    const values = flatData.map((row: any) => Object.values(row));
    const resource = {
      values,
    };
    await this.writeGoogleSheet(resource)
    // Create a new workbook
    const wb = xlsx.utils.book_new();

    // Convert data to worksheet format
    const ws = xlsx.utils.json_to_sheet(flatData);

    // Add the worksheet to the workbook
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet 1');

    // Write the workbook to a buffer
    const buffer = xlsx.write(wb, { bookType: 'xlsx', type: 'buffer' });

    return buffer;
  }

  async generateInvitationCode(clients: Array<Client>): Promise<Array<Client>> {
    const clientsUpdated: Array<Client> = [];

    for (const cli of clients) {
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

      const [clientUpdate, ticketNew] = await Promise.all([
        this.clientModel
          .findByIdAndUpdate(
            new Types.ObjectId(cli._id),
            { $set: { ticket: new Types.ObjectId(ticketClient._id) } },
            { new: true },
          )
          .populate({ path: 'ticket', model: 'Ticket' }),
        this.ticketModel.create(ticketClient),
      ]);

      clientsUpdated.push(clientUpdate);
    }

    return clientsUpdated;
  }

  async generateQrCode(data: string): Promise<string> {
    try {
      const dataUrl = await qrcode.toDataURL(data, {
        errorCorrectionLevel: 'H',
      });
      // const qrBuffer = await qrcode.toBuffer(data, { errorCorrectionLevel: 'H' });
      // const dataUrl = `data:image/png;base64,${qrBuffer.toString('base64')}`;
      return dataUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  }
  async createPrevent(prevent: PreventDataDto): Promise<Prevent> {
    const preventCreated = new this.preventModel({
      name: prevent.name,
      price: prevent.price,
      active: prevent.active,
    });
    return await this.preventModel.create(preventCreated);
  }

  async getPrevents(): Promise<Array<PreventTotalsDto>> {
    const prevents = await this.preventModel.find();
    const result: Array<PreventTotalsDto> = [];

    for (const prev of prevents) {
      const vouchers = await this.voucherModel.find({
        prevent: new Types.ObjectId(prev._id),
      });
      const totalClients = vouchers.reduce(
        (total, voucher) => total + voucher.clients.length,
        0,
      );

      result.push({ prevent: prev, totalClients });
    }

    return result;
  }

  async getActivePrevent(): Promise<Prevent> {
    return await this.preventModel.findOne({ active: true });
  }

  async sendUnauthEmail(unauthMail: string) {
    const dataToEmail: MailDataDto = {
      from: FROM_EMAIL,
      to: unauthMail,
      subject: SubjectDto.UNAUTH,
      text: `Te comunicamos que no cumplis los requisitos de edad para asistir al evento.\n
        FANTOM 9/12 \n
        Te pedimos que te comuniques con <a href="${WppLink}">Mateo</a> para la devolucion de la plata!!\n
        <img style="width: 200px; object-fit: cover;"  src="${FlyerLink}" alt="Flyer" />`,
    };
    return await sendEmail(dataToEmail);
  }

  parseClientTickets(ticketsToSend: Array<string>): Array<string> {
    return ticketsToSend.map((elem) => `${elem}\n`);
  }

  getTicketData(clients: Array<Client>): Array<string> {
    const ticketsToSend: Array<string> = [];
    for (const cli of clients) {
      const nameAndQrTicket = `Nombre: ${cli.fullName}, DNI: ${cli.dni}
      <img style="width: 150px; object-fit: cover;" src="${cli.ticket.url}" alt="QRcode" />`;
      ticketsToSend.push(nameAndQrTicket);
    }
    return this.parseClientTickets(ticketsToSend);
  }

  async sendAuthEmail(ticketData: TicketSendDto) {
    const ticketsToSend: Array<string> = this.getTicketData(ticketData.clients);

    const dataToEmail: MailDataDto = {
      from: FROM_EMAIL,
      to: ticketData.mailTo,
      subject: SubjectDto.AUTH,
      text: `Te mandamos tu entrada para el evento. \n
        FANTOM 9/12 \n
        Para visualizar la entrada, permiti descargar el contenido bloqueado!!\n
        ${ticketsToSend}\n
        <img style="width: 200px; object-fit: cover;"  src="${FlyerLink}" alt="Flyer" />`,
    };
    return await sendEmail(dataToEmail);
  }

  async getToken(loginDto: LoginDto): Promise<SecurityDto> {
    const { email, password } = loginDto;
    try {
      const userCredential = await signInWithEmailAndPassword(
        firebaseClientAuth,
        email,
        password,
      );

      const idToken = await userCredential.user.getIdToken();
      const refreshToken = userCredential.user.refreshToken;

      return { access_token: idToken, refresh_token: refreshToken };
    } catch (error: any) {
      throw new Error(`Failed to get token: ${error.message}`);
    }
  }

  async createGoogleClient() {
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const authClient = await auth.getClient();
    return google.sheets({ version: 'v4', auth: authClient as any });
  }

  async sheetsFileGoogle() {
    const sheetId = '1lK1Xd8kBR0QQs3_VprTawUpBFjZydFQfB6O_y9xDVdI';
    const tabName = 'entradas';
    const range = 'A:H';
    const googleSheetClient = await this.createGoogleClient();

    const res = await googleSheetClient.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}!${range}`,
    });

    const numRows = res.data.values ? res.data.values.length : 0;
    return numRows + 1;
  }

  async writeGoogleSheet(resource: any) {
    const sheets = await this.createGoogleClient();
    const sheetId = '1lK1Xd8kBR0QQs3_VprTawUpBFjZydFQfB6O_y9xDVdI';
    const range = 'A:H';

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: range,
        valueInputOption: 'RAW',
        requestBody: {
          range: range,
          majorDimension: 'ROWS',
          values: resource.values,
        },
      });
      console.log('Data successfully written to Google Sheets.');
    } catch (error) {
      console.error('Error writing data to Google Sheets:', error);
    }
  }

  async appendGoogleSheet(resource: any) {
    const sheets = await this.createGoogleClient();
    const sheetId = '1lK1Xd8kBR0QQs3_VprTawUpBFjZydFQfB6O_y9xDVdI';
    const range = 'A:H';

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: range,
        valueInputOption: 'RAW',
        requestBody: {
          range: range,
          majorDimension: 'ROWS',
          values: resource.values,
        },
      });
      console.log('Data successfully written to Google Sheets.');
    } catch (error) {
      console.error('Error writing data to Google Sheets:', error);
    }
  }
}
