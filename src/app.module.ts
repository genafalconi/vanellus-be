import { Module } from '@nestjs/common';
import { TicketModule } from './ticket/ticket.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ComprobanteModule } from './comprobante/comprobante.module';

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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
