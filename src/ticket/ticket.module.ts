import { Module } from '@nestjs/common';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Ticket, TicketSchema } from 'src/schema/ticket.schema';
import { Client, ClientSchema } from 'src/schema/client.schema';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryProvider } from 'src/helpers/cloudinary.config';


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ticket.name, schema: TicketSchema },
      { name: Client.name, schema: ClientSchema }
    ]),
    ConfigModule
  ],
  controllers: [TicketController],
  providers: [
    TicketService,
    CloudinaryProvider,
    Map
  ]
})
export class TicketModule { }
