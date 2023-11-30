import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  // Para poder subir imgs
  app.use(bodyParser.urlencoded({ extended: true }));
  app.useBodyParser('urlencoded');
  app.useBodyParser('json');
  app.useBodyParser('raw');
  app.useBodyParser('text');

  await app.listen(4000);
}

bootstrap();
