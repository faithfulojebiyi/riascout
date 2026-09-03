import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { localAdapter } from './local.adapter.js';

describe('local storage adapter', () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'riascout-storage-'));
    process.env.STORAGE_LOCAL_DIR = root;
    process.env.STORAGE_PUBLIC_URL = 'http://localhost:3320';
  });

  afterAll(async () => {
    await rm(root, { force: true, recursive: true });
    delete process.env.STORAGE_LOCAL_DIR;
    delete process.env.STORAGE_PUBLIC_URL;
  });

  it('writes under the root and returns a servable url', async () => {
    const object = await localAdapter.put(
      'avatars/one.png',
      Buffer.from('first'),
      { contentType: 'image/png' },
    );

    expect(object.url).toBe('http://localhost:3320/uploads/avatars/one.png');
    expect(object.size).toBe(5);
    await expect(readFile(join(root, 'avatars/one.png'), 'utf8')).resolves.toBe(
      'first',
    );
  });

  it('round-trips through get', async () => {
    await localAdapter.put('docs/note.txt', Buffer.from('hello'));

    expect((await localAdapter.get('docs/note.txt')).toString()).toBe('hello');
  });

  it('lists by prefix', async () => {
    const listing = await localAdapter.list('avatars/');

    expect(listing.objects.map((object) => object.path)).toContain(
      'avatars/one.png',
    );
    expect(listing.objects.every((object) => object.path.startsWith('avatars/'))).toBe(
      true,
    );
    expect(listing.hasMore).toBe(false);
  });

  it('treats removing a missing object as a success, like the object stores', async () => {
    await expect(localAdapter.remove('avatars/absent.png')).resolves.toBeUndefined();
  });

  /**
   * Object keys become filesystem paths here, which they do not in the object
   * stores, so this is the one failure mode the local driver adds.
   */
  it.each(['../escaped.txt', 'avatars/../../escaped.txt'])(
    'refuses a path that escapes the root: %s',
    async (path) => {
      await expect(localAdapter.put(path, Buffer.from('x'))).rejects.toThrow(
        'escapes the root',
      );
    },
  );
});
