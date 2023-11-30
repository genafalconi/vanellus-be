import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as bodyParser from 'body-parser';
import * as multer from 'multer';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  // Para poder subir imgs
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.text({ type: '/' })); 
  const storage = multer.memoryStorage();
  const upload = multer({ storage: storage });
  app.use(upload.any());

  await app.listen(4000);
}

bootstrap();
