import { Body, Controller, Get, Inject, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { BuyTicketsDataDto, PreventDataDto } from 'src/data/client.dto';
import { CloudinaryFileInterceptor, CloudinaryInterceptor } from 'src/helpers/cloudinary.interceptor';
import { Client } from 'src/schema/client.schema';
import { CustomRequest } from 'src/firebase/customRequest';
import { FirebaseAuthGuard } from 'src/firebase/firebase.auth.guard';
import { Ticket } from 'src/schema/ticket.schema';
import { Prevent } from 'src/schema/prevent.schema';

@Controller('ticket')
export class TicketController {
  constructor(
    @Inject(TicketService)
    private readonly ticketService: TicketService
  ) { }

  @Post('/create')
  @UseInterceptors(CloudinaryFileInterceptor, CloudinaryInterceptor)
  async createTicket(@Body() ticketsBuy: BuyTicketsDataDto): Promise<Array<Client>> {
    return await this.ticketService.createTicket(ticketsBuy);
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
