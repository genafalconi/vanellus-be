import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as xlsx from 'xlsx';
import { google } from 'googleapis';
import {
  BuyTicketsDataDto,
  ClientDataDto,
} from 'src/data/client.dto';
import { Client } from 'src/schema/client.schema';
import { Prevent } from 'src/schema/prevent.schema';
import { Voucher } from 'src/schema/voucher.schema';
import MercadoPagoConfig, { Preference } from 'mercadopago';

@Injectable()
export class TicketService {
  private sheetId: string = '1UdKuIPL1AAfgSjzowE9Mg8wUDDtTM6y3TtPXsOIvAsA';
  private client: MercadoPagoConfig;

  constructor(
    @InjectModel(Client.name)
    private readonly clientModel: Model<Client>,
    @InjectModel(Prevent.name)
    private readonly preventModel: Model<Prevent>,
    @InjectModel(Voucher.name)
    private readonly voucherModel: Model<Voucher>,
  ) {
    this.client = new MercadoPagoConfig({ accessToken: 'TEST-1257158260921955-030314-f2bfa12212d7a4901e43002e8468b5bc-142770605', options: { timeout: 5000 } });
  }

  async createTicket(ticketsData: BuyTicketsDataDto): Promise<{ success: boolean, message: string }> {
    const clientSaved: Array<Client> = [];
    const parsedClients: Array<ClientDataDto> = ticketsData.clients;
    const prevent = await this.preventModel.findById(new Types.ObjectId(ticketsData.prevent));

    if (prevent.active) {
      for (const cli of parsedClients) {
        let existingClient = await this.clientModel.findOne({
          $or: [
            { fullName: cli.fullName.trim().toLowerCase() },
            { dni: cli.dni }
          ]
        });

        if (!existingClient) {
          const newClient = new this.clientModel({
            fullName: cli.fullName.trim().toLowerCase(),
            dni: cli.dni,
            sexo: cli.sexo,
          });
          const saved = await this.clientModel.create(newClient);
          clientSaved.push(saved);
        } else {
          return { success: false, message: "El cliente ya existe" };
        }
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
        newComprobante?.email,
        newComprobante?.url || 'no url',
        parsedClients.length,
        'NO',
        'NO',
        prevent.name
      ]);
      const resource = { values };
      // Wait for the Google Sheet to be updated.
      try {
        const sheetResult = await this.appendGoogleSheet(resource);
        if (!sheetResult) {
          this.clientModel.deleteMany({ _id: { $in: clientSaved.map(c => c._id) } });
          throw new HttpException('Failed to update Google Sheet', HttpStatus.INTERNAL_SERVER_ERROR);
        }
      } catch (error) {
        this.clientModel.deleteMany({ _id: { $in: clientSaved.map(c => c._id) } });
        throw new HttpException('Error updating Google Sheet: ' + error, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      // NOT WORKING YET
      // await this.createPaymentLink(newComprobante, prevent);
      // Once the Google Sheet update is successful, save the voucher in the DB.
      await this.voucherModel.create(newComprobante);
      return { success: true, message: "Cliente creado correctamente" }
    } else {
      throw new HttpException('La preventa esta vencida', HttpStatus.BAD_REQUEST)
    }
  }

  async getTickets(prevent: string): Promise<Array<Voucher>> {
    return await this.voucherModel
      .find({ prevent: new Types.ObjectId(prevent) })
      .populate({
        path: 'clients',
        model: 'Client',
        populate: {
          path: 'ticket',
          model: 'Ticket'
        }
      })
      .sort({ createdAt: -1 });
  }

  async generateExcelFile(prevent: string): Promise<Buffer> {
    // Query all vouchers filtering by prevent and populate prevent, clients, and ticket
    const vouchers = await this.voucherModel
      .find({ prevent: new Types.ObjectId(prevent) })
      .populate({ path: 'prevent', model: 'Prevent' })
      .populate({
        path: 'clients',
        model: 'Client',
        populate: { path: 'ticket', model: 'Ticket' },
      })
      .exec();
  
    // Prepare an array of rows, each representing a client with ticket.sent === true.
    const data = [];
  
    vouchers.forEach(voucher => {
      voucher.clients.forEach(client => {
        if (client.ticket && client.ticket.sent) {
          data.push({
            Nombre: client.fullName,
            Dni: client.dni,
            Sexo: client.sexo,
            Email: voucher.email,
          });
        }
      });
    });
  
    // Create a worksheet from the JSON data array
    const worksheet = xlsx.utils.json_to_sheet(data, {
      header: ['Nombre', 'Dni', 'Sexo', 'Email'],
    });
  
    // Create a new workbook and append the worksheet with a title "Entradas"
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Entradas');
  
    // Write the workbook to a Buffer in XLSX format and return it
    const excelBuffer: Buffer = xlsx.write(workbook, {
      bookType: 'xlsx',
      type: 'buffer',
    });
  
    return excelBuffer;
  }

  updateSentColumn(data: any[]): any[] {
    for (let i = 1; i < data.length; i++) {
      if (data[i][8].toLowerCase() === 'no' && data[i][6].toLowerCase() === 'si') {
        data[i][8] = 'SI';
      }
    }
    return data;
  }

  async generateExcelTickets(data: any[]): Promise<Buffer> {
    const wb = xlsx.utils.book_new();
    const wsData = [
      ['nombre', 'apellido', 'email', 'localizador', 'cantidad', 'seat']
    ];

    data.forEach(item => {
      wsData.push([
        item.fullName,
        '',
        item.email,
        '',
        1,
        '',
      ]);
    });

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet 1');
    return xlsx.write(wb, { bookType: 'xlsx', type: 'buffer' });
  }

  async sheetsFileGoogle(): Promise<any[]> {
    const tabName = 'solo-lectura';
    const range = 'A:Z';
    const googleSheetClient = await this.createGoogleClient();

    const res = await googleSheetClient.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: `${tabName}!${range}`,
    });

    return res.data.values;
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

  async writeGoogleSheet(resource: any, sheet: string) {
    const sheets = await this.createGoogleClient();
    const range = 'A:Z';

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range: `${sheet}!${range}`,
        valueInputOption: 'RAW',
        requestBody: {
          range: `${sheet}!${range}`,
          majorDimension: 'ROWS',
          values: resource.values,
        },
      });
      console.log('Data successfully written to Google Sheets.');
    } catch (error) {
      console.error('Error writing data to Google Sheets:', error);
    }
  }

  async clearGoogleSheet(sheet: string) {
    const sheets = await this.createGoogleClient();
    const range = 'A:Z';

    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: this.sheetId,
        range: `${sheet}!${range}`,
      });
      console.log('Data successfully cleared from Google Sheets.');
    } catch (error) {
      console.error('Error clearing data from Google Sheets:', error);
    }
  }

  async appendGoogleSheet(resource: any): Promise<boolean> {
    try {
      const sheets = await this.createGoogleClient();
      const sheetId = this.sheetId;
      const range = 'A:Z';
      const data = await this.sheetsFileGoogle();

      const existingEntries = data.map(row => ({
        fullName: row[0]?.trim()?.toLowerCase(),
        dni: row[1]?.trim()?.toLowerCase(),
        email: row[3]?.trim()?.toLowerCase()
      }));

      const newEntryExists = resource.values.some(newEntry => {
        const [fullName, dni, , email] = newEntry;
        return existingEntries.some(entry =>
          (entry.fullName === fullName?.trim()?.toLowerCase() ||
            entry.dni === dni?.trim()?.toLowerCase()) &&
          entry.email === email?.trim()?.toLowerCase()
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
                      endColumnIndex: 9,
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
          return true;
        } catch (error) {
          console.error('Error writing data to Google Sheets:', error);
          return false;
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
          return true;
        } catch (error) {
          console.error('Error writing data to Google Sheets:', error);
          return false;
        }
      }
    } catch (error) {
      console.log('error writing data to Google Sheets:', error);
      return false;
    }
  }

  async createPaymentLink(voucher: Voucher, prevent: Prevent): Promise<string> {
    const preference = new Preference(this.client);

    const preferenceData = {
      items: [
        {
          id: voucher._id as string,
          title: prevent.name,
          quantity: 1,
          currency_id: 'ARS',
          unit_price: voucher.total,
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
