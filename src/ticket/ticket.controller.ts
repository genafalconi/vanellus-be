import { Body, Controller, Get, HttpStatus, Inject, ParseFilePipeBuilder, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { BuyTicketsDataDto, PreventDataDto } from 'src/data/client.dto';
import { Client } from 'src/schema/client.schema';
import { CustomRequest } from 'src/firebase/customRequest';
import { FirebaseAuthGuard } from 'src/firebase/firebase.auth.guard';
import { Ticket } from 'src/schema/ticket.schema';
import { Prevent } from 'src/schema/prevent.schema';
import { FileInterceptor } from '@nestjs/platform-express';

const MAX_FILE_SIZE_IN_BYTES = 3 * 1024 * 1024; // 3 MB

@Controller('ticket')
export class TicketController {
  constructor(
    @Inject(TicketService)
    private readonly ticketService: TicketService
  ) { }

  @Post('/create')
  @UseInterceptors(FileInterceptor('comprobante'))
  async createTicket(
    @Body() ticketsBuy: BuyTicketsDataDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_FILE_SIZE_IN_BYTES })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    ) comprobante: Express.Multer.File
  ): Promise<Array<Client>> {
    const fileUrl = await this.ticketService.saveFileCloudinary(comprobante)
    return await this.ticketService.createTicket(ticketsBuy, fileUrl);
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
