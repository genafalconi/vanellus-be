import { Module } from '@nestjs/common';
import { TicketModule } from './ticket/ticket.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env`,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        uri: config.get('MONGO_DB'),
        maxPoolSize: 10,
        autoIndex: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }),
      inject: [ConfigService],
    }),
    TicketModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
