import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';

export const STORAGE_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type StorageImageType = (typeof STORAGE_IMAGE_TYPES)[number];

const IMAGE_EXTENSIONS: Record<StorageImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** the url prefix the files are served under, shared with the static route */
export const STORAGE_URL_PREFIX = '/uploads';

export const storageRoot = (): string =>
  resolve(process.env.STORAGE_LOCAL_DIR ?? 'storage/uploads');

/**
 * Local disk today. The seam exists so an object store swaps in behind putImage
 * without a caller changing — the return is always a url, never a path.
 */
@Injectable()
export class StorageService {
  async putImage(data: Buffer, contentType: StorageImageType): Promise<string> {
    const extension = IMAGE_EXTENSIONS[contentType];

    if (!extension) {
      throw new UnsupportedMediaTypeException(
        `Expected one of ${STORAGE_IMAGE_TYPES.join(', ')}`,
      );
    }

    const name = `${randomUUID()}.${extension}`;
    const root = storageRoot();

    await mkdir(root, { recursive: true });
    await writeFile(join(root, name), data);

    return `${this.publicBase()}${STORAGE_URL_PREFIX}/${name}`;
  }

  /** absolute so the url survives being stored on a record and read anywhere */
  private publicBase(): string {
    const base =
      process.env.STORAGE_PUBLIC_URL ??
      process.env.BETTER_AUTH_URL ??
      'http://localhost:3320';

    return base.replace(/\/+$/, '');
  }
}
