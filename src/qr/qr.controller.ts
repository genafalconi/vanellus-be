import { Body, Controller, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { QrService } from './qr.service';
import { CreateTicketsDto, TicketSendDto } from 'src/data/ticket.dto';
import { Client } from 'src/schema/client.schema';
import { FirebaseAuthGuard } from 'src/firebase/firebase.auth.guard';

@UseGuards(FirebaseAuthGuard)
@Controller('qr')
export class QrController {
  constructor(
    @Inject(QrService)
    private readonly qrService: QrService
  ) {}

  @Post('/createQr')
  async createQrAndEmail(@Query('clientId') clientId: string): Promise<Client> {
    return await this.qrService.createQrCode(clientId);
  }

  @Post('/email/unauthorized')
  async sendUnauthorizedEmail(@Query('mail_to') unauthMail: string) {
    return await this.qrService.sendUnauthEmail(unauthMail);
  }

  @Post('/email/authorized')
  async sendAuthorizedEmail(@Body() ticketMail: TicketSendDto) {
    return await this.qrService.sendAuthEmail(ticketMail);
  }

  @Post('/validate')
  async validateQr(@Body() ticketMail: any) {
    return await this.qrService.validateQrData(ticketMail);
  }
}
