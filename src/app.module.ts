import { Module } from '@nestjs/common';
import { TicketModule } from './ticket/ticket.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ComprobanteModule } from './comprobante/comprobante.module';
import { QrModule } from './qr/qr.module';
import { PreventModule } from './prevent/prevent.module';
import { EventModule } from './event/event.module';
import { SecurityModule } from './security/security.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env`,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        uri: config.get('MONGO_DB'),
        maxPoolSize: 1,
        autoIndex: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }),
      inject: [ConfigService],
    }),
    TicketModule,
    ComprobanteModule,
    QrModule,
    PreventModule,
    EventModule,
    SecurityModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 2,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 10
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100
      }
    ]),
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
