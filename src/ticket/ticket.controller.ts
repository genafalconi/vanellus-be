import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TicketService } from './ticket.service';
import {
  BuyTicketsDataDto,
  PreventDataDto,
  PreventTotalsDto,
} from 'src/data/client.dto';
import { Client } from 'src/schema/client.schema';
import { CustomRequest } from 'src/firebase/customRequest';
import { FirebaseAuthGuard } from 'src/firebase/firebase.auth.guard';
import { Prevent } from 'src/schema/prevent.schema';
import { Voucher } from 'src/schema/voucher.schema';
import { CreateTicketsDto, TicketSendDto } from 'src/data/ticket.dto';
import { LoginDto, SecurityDto } from 'src/data/login.dto';

@Controller('ticket')
export class TicketController {
  constructor(
    @Inject(TicketService)
    private readonly ticketService: TicketService,
  ) {}

  @Post('/create')
  async createTicket(@Body() ticketsBuy: BuyTicketsDataDto): Promise<Voucher> {
    return await this.ticketService.createTicket(ticketsBuy);
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('/')
  async getTickets(@Query('prevent') prevent: string): Promise<Array<Voucher>> {
    return await this.ticketService.getTickets(prevent);
  }

  @Get('/verify-token')
  async verifyTokenFirebase(@Req() req: CustomRequest): Promise<boolean> {
    return await this.ticketService.verifyToken(req.headers.authorization);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('/createQr')
  async createQrAndEmail(
    @Body() ticketsData: CreateTicketsDto,
  ): Promise<Array<Client>> {
    return await this.ticketService.createQrCode(ticketsData);
  }

  @Post('/excel')
  async generateQrExcel(): Promise<any> {
    return await this.ticketService.generateExcelFile();
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

  @Post('/email/unauthorized')
  async sendUnauthorizedEmail(@Query('mail_to') unauthMail: string) {
    return await this.ticketService.sendUnauthEmail(unauthMail);
  }

  @Post('/email/authorized')
  async sendAuthorizedEmail(@Body() ticketMail: TicketSendDto) {
    return await this.ticketService.sendAuthEmail(ticketMail);
  }

  @Post('/token')
  async getTokenFirebase(@Body() login: LoginDto): Promise<SecurityDto> {
    return await this.ticketService.getToken(login);
  }
}
