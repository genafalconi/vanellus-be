import { Controller, Inject, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ComprobanteService } from './comprobante.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('comprobante')
export class ComprobanteController {
constructor(
  @Inject(ComprobanteService)
  private readonly comprobanteService: ComprobanteService,
) {}
  
  @Post('upload')
  @UseInterceptors(FileInterceptor('comprobante'))
  async uploadImage(@UploadedFile() file: Express.Multer.File): Promise<{ success: boolean; fileUrl: string }> {
    return await this.comprobanteService.uploadImage(file);
  }
}
