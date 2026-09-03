import { get, list, put, remove } from '@tigrisdata/storage';

import type {
  PutOptions,
  StorageAdapter,
  StorageListing,
  StorageObject,
} from '../adapter.js';

/**
 * The SDK returns `{ data, error }` and never throws, so an unchecked call reads
 * as a success with an undefined body. Every call goes through here.
 */
const unwrap = <T>(
  result: { data: T; error?: never } | { error: Error; data?: never },
  operation: string,
): T => {
  if (result.error) {
    throw new Error(`storage ${operation} failed: ${result.error.message}`, {
      cause: result.error,
    });
  }

  return result.data;
};

export const tigrisAdapter: StorageAdapter = {
  name: 'tigris',

  async put(path, body, options: PutOptions = {}): Promise<StorageObject> {
    const response = unwrap(
      await put(path, body, {
        access: options.access ?? 'private',
        contentType: options.contentType,
        multipart: options.multipart ?? false,
      }),
      'put',
    );

    return {
      url: response.url,
      path: response.path,
      size: response.size,
      contentType: response.contentType,
    };
  },

  async get(path): Promise<Buffer> {
    const file = unwrap(await get(path, 'file'), 'get');

    return Buffer.from(await file.arrayBuffer());
  },

  async remove(path): Promise<void> {
    unwrap(await remove(path), 'remove');
  },

  /**
   * One page. The caller drives pagination with the returned token — the SDK
   * defaults to 100 and silently truncates otherwise.
   */
  async list(prefix, paginationToken): Promise<StorageListing> {
    const response = unwrap(await list({ prefix, paginationToken }), 'list');

    return {
      objects: response.items.map((item) => ({
        url: item.id,
        path: item.name,
        size: item.size,
      })),
      hasMore: response.hasMore,
      paginationToken: response.paginationToken,
    };
  },
};
