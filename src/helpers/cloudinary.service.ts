import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  async uploadFile(file: Express.Multer.File): Promise<string> {
    const { buffer } = file;

    const result: any = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({ resource_type: 'auto', folder: 'Vanellus' }, async (error, result) => {
        if (error) {
          reject(error);
        }
        resolve(result);
      }).end(buffer);
    });

    return result?.url;
  }
}
