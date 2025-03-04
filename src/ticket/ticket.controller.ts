import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Res,
  UseGuards
} from '@nestjs/common';
import { TicketService } from './ticket.service';
import { BuyTicketsDataDto } from 'src/data/client.dto';
import { Voucher } from 'src/schema/voucher.schema';
import { FirebaseAuthGuard } from 'src/firebase/firebase.auth.guard';
import { Response } from 'express';

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

  @UseGuards(FirebaseAuthGuard)
  @Get('download')
  async downloadExcel(
    @Res() res: Response,
    @Query('prevent') prevent: string
  ) {
    const excelBuffer = await this.ticketService.generateExcelFile(prevent);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=entradas.xlsx');
    res.end(excelBuffer);
  }

  @Get('sheets')
  async sheetsFileGoogle() {
    return await this.ticketService.sheetsFileGoogle();
  }
}
