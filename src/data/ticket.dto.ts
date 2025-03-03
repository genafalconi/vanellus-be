import { Client } from 'src/schema/client.schema';

export class TicketDto {
  id: number;
  ticketUrl: string;
  used: boolean;
  active: boolean;
  sent: boolean;
}

export class TicketSendDto {
  mailTo: string;
  clients: Array<Client>;
}

export class CreateTicketsDto {
  clients: Array<Client>;
  email: string;
  voucherId: string;
}
