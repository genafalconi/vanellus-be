export interface CustomHeaders extends Headers {
  authorization: string;
}

export interface CustomRequest extends Request {
  headers: CustomHeaders;
  user?: {
    uid: string;
  };
}
