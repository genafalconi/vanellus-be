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
import { firebaseAdminConfig } from 'src/firebase/firebaseAdmin';

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
        sexo: cli.sexo
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
      cli.dni,
      cli.sexo,
      newComprobante.email,
      newComprobante.url,
      parsedClients.length,
      '',
      '',
      'NO'
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

  async generateExcelFile(): Promise<boolean> {
    try {
      const data = await this.sheetsFileGoogle();
      const filteredData = data.filter(row => row[6] === 'SI' && row[8] === 'NO');

      // Map filtered data to match the template
      const wsData = filteredData.map(item => [
        item[0],  // nombre
        '',  // apellido (assuming DNI is to be split)
        item[3].toLowerCase(),  // email
        '',  // localizador
        1,  // cantidad
        ''  // seat (assuming seat is not provided in the original data)
      ]);

      // Define headers
      const headers = ['nombre', 'apellido', 'email', 'localizador', 'cantidad', 'seat'];

      const excelData = [headers, ...wsData];
      let resource = { values: excelData };

      let sheet = 'enviadas';
      await this.writeGoogleSheet(resource, sheet);

      sheet = 'entradas';
      const updatedData = this.updateSentColumn(data);
      resource = { values: updatedData };
      await this.writeGoogleSheet(resource, sheet);

      return true;
    } catch (error) {
      console.error('Error generating Excel file:', error);
      throw error;
    }
  }

  updateSentColumn(data) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][8] === 'NO' && data[i][6] !== 'NO') {
        data[i][8] = 'SI';
      }
    }
    return data;
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
    const range = 'A:Z';
    const googleSheetClient = await this.createGoogleClient();

    const res = await googleSheetClient.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}!${range}`,
    });

    return res.data.values;
  }

  async writeGoogleSheet(resource: any, sheet: any) {
    const sheets = await this.createGoogleClient();
    const sheetId = '1lK1Xd8kBR0QQs3_VprTawUpBFjZydFQfB6O_y9xDVdI';
    const range = 'A:Z';

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheet}!${range}`,
        valueInputOption: 'RAW',
        requestBody: {
          range: `${sheet}!${range}`,
          majorDimension: 'ROWS',
          values: resource.values,
        },
      });
      console.log('Data successfully written to Google Sheets.');
      return;
    } catch (error) {
      console.error('Error writing data to Google Sheets:', error);
      return;
    }
  }

  async appendGoogleSheet(resource: any) {
    const sheets = await this.createGoogleClient();
    const sheetId = '1lK1Xd8kBR0QQs3_VprTawUpBFjZydFQfB6O_y9xDVdI';
    const range = 'A:H';
    const data = await this.sheetsFileGoogle();

    const existingEntries = data.map(row => ({
      fullName: row[0].trim().toLowerCase(),
      email: row[3].trim().toLowerCase()
    }));

    const newEntryExists = resource.values.some(newEntry => {
      const [fullName, , , email] = newEntry;
      return existingEntries.some(entry =>
        entry.fullName === fullName.trim().toLowerCase() &&
        entry.email === email.trim().toLowerCase()
      );
    });

    if (newEntryExists) {
      console.log('Duplicate entry found. Adding with red background.');

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

        const startRow = data.length;
        const endRow = startRow + resource.values.length;

        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: {
                    startRowIndex: startRow,
                    endRowIndex: endRow,
                    startColumnIndex: 0,
                    endColumnIndex: 8,
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: {
                        red: 1.0,
                        green: 0.0,
                        blue: 0.0
                      }
                    }
                  },
                  fields: 'userEnteredFormat.backgroundColor'
                }
              }
            ]
          }
        });

        console.log('Data successfully written to Google Sheets with red background.');
      } catch (error) {
        console.error('Error writing data to Google Sheets:', error);
      }
    } else {
      console.log('No duplicate entry found. Adding normally.');

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

  async generateExcelTickets(data) {


    const wb = xlsx.utils.book_new();

    // Define the worksheet data
    const wsData = [
      ['nombre', 'apellido', 'email', 'localizador', 'cantidad', 'seat']
    ];

    // Map data to match the template
    data.forEach(item => {
      wsData.push([
        item.fullName,
        '', // Assuming no last name in your example
        item.email,
        '', // Assuming no locator in your example
        1, // Always set cantidad to 1
        '' // Assuming no seat info in your example
      ]);
    });

    // Create a new worksheet with the data
    const ws = xlsx.utils.aoa_to_sheet(wsData);

    // Add the worksheet to the workbook
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet 1');

    // Write the workbook to a buffer
    const buffer = xlsx.write(wb, { bookType: 'xlsx', type: 'buffer' });

    return buffer;
  }
}
