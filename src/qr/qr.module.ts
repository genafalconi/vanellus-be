import { Module } from '@nestjs/common';
import { QrService } from './qr.service';
import { QrController } from './qr.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Ticket, TicketSchema } from 'src/schema/ticket.schema';
import { Client, ClientSchema } from 'src/schema/client.schema';
import { Voucher, VoucherSchema } from 'src/schema/voucher.schema';
import { Prevent, PreventSchema } from 'src/schema/prevent.schema';
import { Event, EventSchema } from 'src/schema/event.schema';
import { ConfigModule } from '@nestjs/config';
import { ComprobanteModule } from 'src/comprobante/comprobante.module';

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
    ComprobanteModule
  ],
  providers: [QrService],
  controllers: [QrController]
})
export class QrModule { }
