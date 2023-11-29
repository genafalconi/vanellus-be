import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { v2 as cloudinary } from 'cloudinary';
import { Observable } from 'rxjs';

@Injectable()
export class CloudinaryInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const file = request.file;

    if (file) {
      const { buffer } = file;

      const result: any = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ resource_type: 'auto', folder: 'Vanellus' }, async (error, result) => {
          if (error) {
            reject(error);
          }
          resolve(result);
        }).end(buffer);
      });

      request.body.cloudinaryUrl = result?.url;
    }

    return next.handle();
  }
}

export const CloudinaryFileInterceptor = FileInterceptor('comprobante');