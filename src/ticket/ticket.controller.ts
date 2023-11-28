import { Body, Controller, Get, Inject, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { ClientDto } from 'src/data/client.dto';
import { CloudinaryFileInterceptor, CloudinaryInterceptor } from 'src/helpers/cloudinary.interceptor';
import { Client } from 'src/schema/client.schema';
import { CustomRequest } from 'src/firebase/customRequest';
import { FirebaseAuthGuard } from 'src/firebase/firebase.auth.guard';

@Controller('ticket')
export class TicketController {
  constructor(
    @Inject(TicketService)
    private readonly ticketService: TicketService
  ) { }

  @Post('/create')
  @UseInterceptors(CloudinaryFileInterceptor, CloudinaryInterceptor)
  async createTicket(@Body() client: ClientDto): Promise<Array<Client>> {
    return await this.ticketService.createTicket(client);
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('/')
  async getTickets() {
    return await this.ticketService.getTickets();
  }

  @Get('/verify-token')
  async verifyTokenFirebase(@Req() req: CustomRequest): Promise<boolean> {
    return await this.ticketService.verifyToken(req.headers.authorization);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('/createQr')
  async createQrAndEmail(@Query('client') client: string): Promise<string> {
    return await this.ticketService.createQrCode(client);
  }
}
