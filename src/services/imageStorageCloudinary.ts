import { v2 as cloudinary } from 'cloudinary';
import type { ImageStorage, UploadedImage } from './imageStorage';

export class CloudinaryStorage implements ImageStorage {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  async upload(buffer: Buffer, _mimeType: string, opts: {
    restaurantId: string;
    folder: string;
  }): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `gastropro/${opts.restaurantId}/${opts.folder}`,
          resource_type: 'image',
          quality: 'auto:good',
          fetch_format: 'auto',
          transformation: [{ width: 1200, height: 1200, crop: 'limit' }],
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
          resolve({
            url: result.secure_url,
            public_id: result.public_id,
            size_bytes: result.bytes,
            width: result.width,
            height: result.height,
          });
        },
      );
      stream.end(buffer);
    });
  }

  async delete(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }
}
