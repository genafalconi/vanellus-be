import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { TicketService } from './ticket.service';
import { BuyTicketsDataDto } from 'src/data/client.dto';
import { Voucher } from 'src/schema/voucher.schema';
import { FirebaseAuthGuard } from 'src/firebase/firebase.auth.guard';

@Controller('ticket')
export class TicketController {
  constructor(
    @Inject(TicketService)
    private readonly ticketService: TicketService,
  ) { }
  @Post('/create')
  async createTicket(@Body() ticketsBuy: BuyTicketsDataDto): Promise<{ success: boolean, message: string }> {
    return await this.ticketService.createTicket(ticketsBuy);
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('/')
  async getTickets(@Query('prevent') prevent: string): Promise<Array<Voucher>> {
    return await this.ticketService.getTickets(prevent);
  }

  @Get('download')
  async downloadExcel(): Promise<boolean> {
    return await this.ticketService.generateExcelFile();
  }

  @Get('sheets')
  async sheetsFileGoogle() {
    return await this.ticketService.sheetsFileGoogle();
  }
}
