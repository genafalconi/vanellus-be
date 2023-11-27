import { Body, Controller, Get, Inject, Post, Req, UseInterceptors } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { ClientDto } from 'src/data/client.dto';
import { CloudinaryFileInterceptor, CloudinaryInterceptor } from 'src/helpers/cloudinary.interceptor';
import { Client } from 'src/schema/client.schema';

@Controller('ticket')
export class TicketController {
  constructor(
    @Inject(TicketService)
    private readonly ticketService: TicketService
  ) { }

  @Post('/create')
  @UseInterceptors(CloudinaryFileInterceptor, CloudinaryInterceptor)
  async createTicket(@Body() client: ClientDto): Promise<Client> {
    return await this.ticketService.createTicket(client);
  }

  @Get('/')
  async getTickets() {
    return await this.ticketService.getTickets();
  }
}
