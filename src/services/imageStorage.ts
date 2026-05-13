export interface UploadedImage {
  url: string;
  public_id: string;
  size_bytes: number;
  width: number;
  height: number;
}

export interface ImageStorage {
  upload(buffer: Buffer, mimeType: string, opts: {
    restaurantId: string;
    folder: string;
  }): Promise<UploadedImage>;

  delete(publicId: string): Promise<void>;
}

import type { CloudinaryStorage } from './imageStorageCloudinary';
import type { LocalStorage } from './imageStorageLocal';

let cachedStorage: ImageStorage | null = null;

export function getImageStorage(): ImageStorage {
  if (cachedStorage) return cachedStorage;

  const hasCloudinary = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

  if (hasCloudinary) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { CloudinaryStorage: CS } = require('./imageStorageCloudinary') as { CloudinaryStorage: new() => CloudinaryStorage };
    console.log('[IMAGES] Using Cloudinary storage');
    cachedStorage = new CS();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { LocalStorage: LS } = require('./imageStorageLocal') as { LocalStorage: new() => LocalStorage };
    console.warn(
      '[IMAGES] CLOUDINARY_* env vars not configured. ' +
      'Falling back to local filesystem at /uploads. ' +
      'This is suitable for development only.',
    );
    cachedStorage = new LS();
  }

  return cachedStorage;
}
