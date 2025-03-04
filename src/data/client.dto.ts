import { Client } from 'src/schema/client.schema';
import { Prevent } from 'src/schema/prevent.schema';
import { Voucher } from 'src/schema/voucher.schema';

export class ClientDataDto {
  dni: number;
  fullName: string;
  sexo: string;
}

export class BuyTicketsDataDto {
  email: string;
  clients: Array<ClientDataDto>;
  cloudinaryUrl: string;
  prevent: string;
  total: number;
}

export class PreventDataDto {
  name: string;
  price: number;
  active: boolean;
}

export class PreventTotalsDto {
  prevent: Prevent;
  totalClients: number;
  totalPrice: number;
}

export class TicketCreateDto {
  client: Client;
  voucher: Voucher;
}

export class MailDataDto {
  from: string;
  to: string;
  subject: string;
  text: string;
  attachments: Array<Attachments>;
}

export class Attachments {
  filename: string; 
  path: string; 
  cid: string;
}

export const FROM_EMAIL = 'fantomcsb@gmail.com';

export enum SubjectDto {
  AUTH = 'Aca esta tu entrada para la ENVUELTO',
  UNAUTH = 'No cumplis con los requisitos',
}

export const FlyerLink =
  'https://res.cloudinary.com/do2rkxpux/image/upload/v1701296322/Vanellus/Ppal/Flyer_fgwdm5.jpg';

export const WppLink =
  'https://wa.me/+5491161569011?text=Hola!%20Necesito%20la%20devolucion%20de%20entradas%20para%20la%20Fantom';
