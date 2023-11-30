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
  @UseInterceptors(FileInterceptor('comprobante'))
  async createTicket(
    @Body() ticketsBuy: BuyTicketsDataDto,
    @Req() request: Request,
    @UploadedFile() comprobante: Express.Multer.File
  ): Promise<Array<Client>> {
    try {
      const { fields } = await this.parseFileFromRequest(request);
      console.log(comprobante, ticketsBuy, fields)
      const imgUrl = await this.ticketService.saveFileCloudinary(ticketsBuy)

      return await this.ticketService.createTicket({ ...ticketsBuy, cloudinaryUrl: imgUrl });
    } catch (error) {
      console.error('Error creating ticket:', error);
      throw { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
    }
  }

  async parseFileFromRequest(request: Request): Promise<any> {
    return new Promise((resolve, reject) => {
      const busboy = Busboy({ headers: request.headers, highWaterMark: 2 * 1024 * 1024 });

      const fields: any = {};

      busboy.on('request', (req, res, opts) => {
        req.socket.setTimeout(10000);
      });

      busboy.on('field', (fieldname, val) => {
        fields[fieldname] = val;
        if(fieldname === '__end') {
          resolve({ fields });
        }
      });

      busboy.on('finish', () => {
        if (fields['__end'] === 'true') {
          console.log('Form data complete');
        } else {
          console.log('Form data still being sent');
        }
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
