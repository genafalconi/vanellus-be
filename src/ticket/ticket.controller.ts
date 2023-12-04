import { Body, Controller, Get, HttpException, HttpStatus, Inject, Post, Query, Req, UseGuards } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { BuyTicketsDataDto, PreventDataDto, PreventTotalsDto } from 'src/data/client.dto';
import { Client } from 'src/schema/client.schema';
import { CustomRequest } from 'src/firebase/customRequest';
import { FirebaseAuthGuard } from 'src/firebase/firebase.auth.guard';
import { Ticket } from 'src/schema/ticket.schema';
import { Prevent } from 'src/schema/prevent.schema';
import { Voucher } from 'src/schema/voucher.schema';

@Controller('ticket')
export class TicketController {
  constructor(
    @Inject(TicketService)
    private readonly ticketService: TicketService,
  ) { }

  @Post('/create')
  async createTicket(@Body() ticketsBuy: BuyTicketsDataDto): Promise<Voucher> {
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

  @UseGuards(FirebaseAuthGuard)
  @Post('/createPrevent')
  async createPrevent(@Body() prevent: PreventDataDto): Promise<Prevent> {
    return await this.ticketService.createPrevent(prevent);
  }

  @Get('/getPrevents')
  async getPrevents(): Promise<Array<PreventTotalsDto>> {
    return await this.ticketService.getPrevents();
  }

}
