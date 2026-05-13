import { promises as fs } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import sharp from 'sharp';
import type { ImageStorage, UploadedImage } from './imageStorage';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'menu-items');

export class LocalStorage implements ImageStorage {
  async upload(buffer: Buffer, mimeType: string, opts: {
    restaurantId: string;
    folder: string;
  }): Promise<UploadedImage> {
    const restaurantDir = path.join(UPLOAD_DIR, opts.restaurantId);
    await fs.mkdir(restaurantDir, { recursive: true });

    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const filename = `${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;
    const filepath = path.join(restaurantDir, filename);

    const { data, info } = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, progressive: true })
      .toBuffer({ resolveWithObject: true });

    await fs.writeFile(filepath, data);

    return {
      url: `/uploads/menu-items/${opts.restaurantId}/${filename}`,
      public_id: filename,
      size_bytes: data.length,
      width: info.width,
      height: info.height,
    };
  }

  async delete(publicId: string): Promise<void> {
    try {
      const dirs = await fs.readdir(UPLOAD_DIR).catch(() => [] as string[]);
      for (const dir of dirs) {
        const filepath = path.join(UPLOAD_DIR, dir, publicId);
        try {
          await fs.unlink(filepath);
          return;
        } catch {
          continue;
        }
      }
    } catch (err) {
      console.error('[IMAGES] Failed to delete local image:', err);
    }
  }
}
