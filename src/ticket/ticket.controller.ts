import { Body, Controller, Get, HttpStatus, Inject, ParseFilePipeBuilder, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { BuyTicketsDataDto, PreventDataDto } from 'src/data/client.dto';
import { Client } from 'src/schema/client.schema';
import { CustomRequest } from 'src/firebase/customRequest';
import { FirebaseAuthGuard } from 'src/firebase/firebase.auth.guard';
import { Ticket } from 'src/schema/ticket.schema';
import { Prevent } from 'src/schema/prevent.schema';
import { CloudinaryService } from 'src/helpers/cloudinary.service';
import * as Busboy from 'busboy';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';

const MAX_FILE_SIZE_IN_BYTES = 3 * 1024 * 1024; // 3 MB

@Controller('ticket')
export class TicketController {
  constructor(
    @Inject(TicketService)
    private readonly ticketService: TicketService,
    @Inject(CloudinaryService)
    private readonly cloudinaryService: CloudinaryService
  ) { }

  @Post('/create')
  async createTicket(@Body() ticketsBuy: BuyTicketsDataDto): Promise<Array<Client>> {
    try {
      return await this.ticketService.createTicket(ticketsBuy);
    } catch (error) {
      console.error('Error creating ticket:', error);
      throw { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
    }
  }

  @Post('/comprobante')
  async uploadComprobante(@Req() request: Request): Promise<string> {
    const file = await this.parseFileFromRequest(request)
    console.log(file)
    return await this.ticketService.saveFileCloudinary(file['comprobante'])
  }

  async parseFileFromRequest(request: Request): Promise<Express.Multer.File> {
    return new Promise((resolve, reject) => {
      const busboy = Busboy({ headers: request.headers, highWaterMark: 2 * 1024 * 1024 });

      const file: any = {};

      busboy.on('request', (req, res, opts) => {
        req.socket.setTimeout(30000);
      });

      busboy.once('file', (fieldname, fileStream, filename, encoding, mimeType) => {
        const chunks: Buffer[] = [];

        fileStream.on('data', (data) => {
          chunks.push(data);
        });

        fileStream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          file[fieldname] = {
            fieldname,
            originalname: filename,
            encoding,
            mimetype: mimeType,
            buffer,
            size: buffer.length,
          };
          resolve(file)
        });
      });

      busboy.once('finish', () => {
        resolve(file)
      });

      busboy.once('close', () => {
        resolve(file)
      });

      request.pipe(busboy);
    });
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('/')
  async getTickets(@Query('prevent') prevent: string) {
    return await this.ticketService.getTickets(prevent);
  }

  @Get('/verify-token')
  async verifyTokenFirebase(@Req() req: CustomRequest): Promise<boolean> {
    return await this.ticketService.verifyToken(req.headers.authorization);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('/createQr')
  async createQrAndEmail(@Body() client: Client): Promise<Ticket> {
    return await this.ticketService.createQrCode(client);
  }

  // @UseGuards(FirebaseAuthGuard)
  @Post('/createPrevent')
  async createPrevent(@Body() prevent: PreventDataDto): Promise<Prevent> {
    return await this.ticketService.createPrevent(prevent);
  }

  @Get('/getPrevents')
  async getPrevents(): Promise<Array<Prevent>> {
    return await this.ticketService.getPrevents();
  }

}
