import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import * as functions from 'firebase-functions';
import { AppModule } from './src/app.module';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as bodyParser from 'body-parser';


const expressServer = express();
const createFunction = async (expressInstance: any): Promise<void> => {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(expressInstance),
  );
  app.enableCors()
  app.use(bodyParser.urlencoded({ extended: true }));
  app.useBodyParser('urlencoded');
  app.useBodyParser('json');
  app.useBodyParser('raw');
  app.useBodyParser('text');
  await app.init();
};

export const vanellus = functions.https.onRequest(async (request, response) => {
  await createFunction(expressServer);
  expressServer(request, response);
});