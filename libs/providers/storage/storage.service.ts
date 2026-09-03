import { randomUUID } from 'node:crypto';

import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';

import type {
  PutOptions,
  StorageAdapter,
  StorageListing,
  StorageObject,
} from './adapter.js';
import { localAdapter } from './adapters/local.adapter.js';
import { tigrisAdapter } from './adapters/tigris.adapter.js';

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

/** a prefix rather than the bucket root, so objects stay separable by kind */
const AVATAR_PREFIX = 'avatars';

const ADAPTERS: Record<string, StorageAdapter> = {
  [tigrisAdapter.name]: tigrisAdapter,
  [localAdapter.name]: localAdapter,
};

const selectAdapter = (): StorageAdapter => {
  const name = process.env.STORAGE_DRIVER ?? tigrisAdapter.name;
  const adapter = ADAPTERS[name];

  if (!adapter) {
    throw new Error(
      `Unknown STORAGE_DRIVER "${name}"; expected one of ${Object.keys(ADAPTERS).join(', ')}`,
    );
  }

  return adapter;
};

/**
 * Delegates to the configured adapter. putImage keeps its signature so the
 * callers that predate object storage are untouched — the return is always a
 * url, never a path.
 */
@Injectable()
export class StorageService {
  private readonly adapter = selectAdapter();

  async putImage(data: Buffer, contentType: StorageImageType): Promise<string> {
    const extension = IMAGE_EXTENSIONS[contentType];

    if (!extension) {
      throw new UnsupportedMediaTypeException(
        `Expected one of ${STORAGE_IMAGE_TYPES.join(', ')}`,
      );
    }

    /**
     * Public because the dashboard loads these through an <img> with no
     * session. Everything else defaults to private.
     */
    const object = await this.adapter.put(
      `${AVATAR_PREFIX}/${randomUUID()}.${extension}`,
      data,
      { access: 'public', contentType },
    );

    return object.url;
  }

  put(
    path: string,
    body: Buffer | ReadableStream,
    options?: PutOptions,
  ): Promise<StorageObject> {
    return this.adapter.put(path, body, options);
  }

  get(path: string): Promise<Buffer> {
    return this.adapter.get(path);
  }

  remove(path: string): Promise<void> {
    return this.adapter.remove(path);
  }

  list(prefix: string, paginationToken?: string): Promise<StorageListing> {
    return this.adapter.list(prefix, paginationToken);
  }
}
