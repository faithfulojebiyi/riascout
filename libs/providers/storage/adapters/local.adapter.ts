import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

import type {
  StorageAdapter,
  StorageListing,
  StorageObject,
} from '../adapter.js';

/** the url prefix the files are served under, shared with the static route */
export const STORAGE_URL_PREFIX = '/uploads';

export const storageRoot = (): string =>
  resolve(process.env.STORAGE_LOCAL_DIR ?? 'storage/uploads');

/** absolute so the url survives being stored on a record and read anywhere */
const publicBase = (): string =>
  (
    process.env.STORAGE_PUBLIC_URL ??
    process.env.BETTER_AUTH_URL ??
    'http://localhost:3320'
  ).replace(/\/+$/, '');

/**
 * Object keys are joined onto a filesystem path here, which they are not in the
 * object stores, so `..` would escape the root. Refused rather than normalised:
 * a caller asking for a path outside the bucket has a bug worth surfacing.
 */
const safeJoin = (path: string): string => {
  const root = storageRoot();
  const target = resolve(root, path);

  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`storage path escapes the root: ${path}`);
  }

  return target;
};

const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = join(dir, entry.name);

      return entry.isDirectory() ? walk(full) : [full];
    }),
  );

  return nested.flat();
};

/**
 * Development only. Writes under STORAGE_LOCAL_DIR so uploads survive a restart
 * and can be inspected, and returns a url the api serves — the object stores
 * return one from the provider, so callers see no difference.
 *
 * Nothing here is durable or shared: two processes do not see each other's
 * files, which is why it is not a deployment option.
 */
export const localAdapter: StorageAdapter = {
  name: 'local',

  async put(path, body, options = {}): Promise<StorageObject> {
    const target = safeJoin(path);

    await mkdir(dirname(target), { recursive: true });

    const data = Buffer.isBuffer(body)
      ? body
      : Buffer.from(await new Response(body as BodyInit).arrayBuffer());

    await writeFile(target, data);

    return {
      url: `${publicBase()}${STORAGE_URL_PREFIX}/${path}`,
      path,
      size: data.byteLength,
      contentType: options.contentType,
    };
  },

  get(path): Promise<Buffer> {
    return readFile(safeJoin(path));
  },

  async remove(path): Promise<void> {
    await unlink(safeJoin(path)).catch((error: NodeJS.ErrnoException) => {
      // removing what is not there is the object stores' behaviour too
      if (error.code !== 'ENOENT') {
        throw error;
      }
    });
  },

  /** unpaginated: the whole point is a small local set, so hasMore is always false */
  async list(prefix): Promise<StorageListing> {
    const root = storageRoot();
    const files = await walk(root);

    const objects = await Promise.all(
      files
        .map((file) => relative(root, file).split(sep).join('/'))
        .filter((path) => path.startsWith(prefix))
        .map(async (path) => ({
          url: `${publicBase()}${STORAGE_URL_PREFIX}/${path}`,
          path,
          size: (await stat(join(root, path))).size,
        })),
    );

    return { objects, hasMore: false };
  },
};
