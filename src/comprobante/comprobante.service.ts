import { Injectable } from '@nestjs/common';
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

@Injectable()
export class ComprobanteService {
  private cloudinary: typeof cloudinary;

  constructor(
    
    private readonly configService: ConfigService,
  ) {
    this.cloudinary = cloudinary;
    this.cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(file: Express.Multer.File): Promise<{ success: boolean; fileUrl: string }> {
    return new Promise((resolve, reject) => {
      const stream = this.cloudinary.uploader.upload_stream(
        { resource_type: 'auto', folder: 'Envuelto' },
        (error: any, result: UploadApiResponse) => {
          if (error) {
            return resolve({ success: false, fileUrl: '' });
          }
          resolve({ success: true, fileUrl: result.url });
        },
      );

      Readable.from(file.buffer).pipe(stream);
    });
  }

  async uploadQrImage(file: Express.Multer.File): Promise<{ success: boolean; fileUrl: string }> {
    return new Promise((resolve, reject) => {
      const stream = this.cloudinary.uploader.upload_stream(
        { resource_type: 'auto', folder: 'Qrs' },
        (error: any, result: UploadApiResponse) => {
          if (error) {
            return resolve({ success: false, fileUrl: '' });
          }
          resolve({ success: true, fileUrl: result.url });
        },
      );

      Readable.from(file.buffer).pipe(stream);
    });
  }
}
