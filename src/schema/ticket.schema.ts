import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Client } from './client.schema';
import { Voucher } from './voucher.schema';

@Schema()
export class Ticket extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Client', required: true })
  client: Client;

  @Prop({ type: Types.ObjectId, ref: 'Voucher', required: true })
  voucher: Voucher;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  used: boolean;

  @Prop({ required: true })
  active: boolean;

  @Prop({ required: true })
  sent: boolean;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);
