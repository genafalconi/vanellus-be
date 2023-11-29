export class ClientDataDto {
  dni: number;
  fullName: string;
}

export class BuyTicketsDataDto {
  id: number;
  email: string;
  clients: string;
  cloudinaryUrl: string;
  prevent: string;
  total: number;
}

export class PreventDataDto {
  name: string;
  price: number;
  active: boolean;
}