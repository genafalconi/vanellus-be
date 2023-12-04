import { Prevent } from "src/schema/prevent.schema";

export class ClientDataDto {
  dni: number;
  fullName: string;
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
}