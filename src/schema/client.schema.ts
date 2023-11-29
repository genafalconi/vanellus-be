import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Client extends Document {
  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true })
  dni: string;
}

export const ClientSchema = SchemaFactory.createForClass(Client);
