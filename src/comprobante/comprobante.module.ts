import { Module } from '@nestjs/common';
import { ComprobanteService } from './comprobante.service';
import { ComprobanteController } from './comprobante.controller';
import { ConfigService } from '@nestjs/config';

@Module({
  providers: [ComprobanteService, ConfigService],
  controllers: [ComprobanteController],
  exports: [ComprobanteService]
})
export class ComprobanteModule {}
