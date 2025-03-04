import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Client } from './client.schema';
import { Prevent } from './prevent.schema';

@Schema()
export class Voucher extends Document {
  @Prop([{ type: Types.ObjectId, ref: 'Client', required: true }])
  clients: Client[];

  @Prop({ required: true })
  email: string;

  @Prop({ type: Types.ObjectId, ref: 'Prevent', required: true })
  prevent: Prevent;

  @Prop({ required: true })
  total: number; 

  @Prop({ required: true, default: 'no url' })
  url: string;

  @Prop({ required: true })
  active: boolean; 

  @Prop({ required: true, default: false })
  sent: boolean;
}

export const VoucherSchema = SchemaFactory.createForClass(Voucher);
VoucherSchema.set('timestamps', true);
