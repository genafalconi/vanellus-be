import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class Ticket extends Document {
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
