import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Ticket } from './ticket.schema';

@Schema()
export class Client extends Document {
  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  comprobante: string

  @Prop({ required: true })
  dni: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Ticket' }] })
  ticket: Ticket
}

export const ClientSchema = SchemaFactory.createForClass(Client);