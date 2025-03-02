import { Module } from '@nestjs/common';
import { PreventService } from './prevent.service';
import { PreventController } from './prevent.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Ticket, TicketSchema } from 'src/schema/ticket.schema';
import { Client, ClientSchema } from 'src/schema/client.schema';
import { Voucher, VoucherSchema } from 'src/schema/voucher.schema';
import { Prevent, PreventSchema } from 'src/schema/prevent.schema';
import { Event, EventSchema } from 'src/schema/event.schema';
import { ConfigModule } from '@nestjs/config';

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
  providers: [PreventService],
  controllers: [PreventController]
})
export class PreventModule {}
