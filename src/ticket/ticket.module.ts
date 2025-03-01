import { Module } from '@nestjs/common';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Ticket, TicketSchema } from 'src/schema/ticket.schema';
import { Client, ClientSchema } from 'src/schema/client.schema';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryProvider } from 'src/helpers/cloudinary.config';
import { Voucher, VoucherSchema } from 'src/schema/voucher.schema';
import { Prevent, PreventSchema } from 'src/schema/prevent.schema';
import { EventSchema } from 'src/schema/event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ticket.name, schema: TicketSchema },
      { name: Client.name, schema: ClientSchema },
      { name: Voucher.name, schema: VoucherSchema },
      { name: Prevent.name, schema: PreventSchema },
      { name: Event.name, schema: EventSchema },
    ]),
    ConfigModule,
  ],
  controllers: [TicketController],
  providers: [TicketService, CloudinaryProvider],
})
export class TicketModule {}
