import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Prevent } from './prevent.schema';

@Schema()
export class Event extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  number: number;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  hours: string;

  @Prop({ required: true })
  bar: string;

  @Prop({ required: true })
  venue: string;

  @Prop({ required: true, default: true })
  active: boolean;

  @Prop({ required: true })
  contact: string;

  @Prop({ required: true })
  phone: string;

  @Prop([{ type: Types.ObjectId, ref: 'Prevent', required: true }]) 
  prevents: Prevent[];
}

export const EventSchema = SchemaFactory.createForClass(Event);