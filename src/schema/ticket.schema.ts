import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class Ticket extends Document {
  @Prop({ required: true })
  ticketUrl: string;

  @Prop({ default: false })
  used: boolean;

  @Prop({ default: false })
  active: boolean;

  @Prop({ default: false })
  sent: boolean;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);
