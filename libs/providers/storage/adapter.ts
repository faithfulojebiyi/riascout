export type StorageAccess = 'public' | 'private';

export type PutOptions = {
  /**
   * Private unless a caller says otherwise. Avatars are public because an <img>
   * in the dashboard loads them with no session; everything else is not.
   */
  access?: StorageAccess;
  contentType?: string;
  /** the SDK streams above ~100MB rather than buffering the whole body */
  multipart?: boolean;
};

export type StorageObject = {
  /** absolute, so it survives being written to a record and read anywhere */
  url: string;
  path: string;
  size?: number;
  contentType?: string;
};

export type StorageListing = {
  objects: StorageObject[];
  hasMore: boolean;
  paginationToken?: string;
};

/**
 * The seam. Tigris is the only implementation today; an S3 adapter is a second
 * file behind this interface rather than a change at any call site.
 */
export type StorageAdapter = {
  readonly name: string;
  put(
    path: string,
    body: Buffer | ReadableStream,
    options?: PutOptions,
  ): Promise<StorageObject>;
  get(path: string): Promise<Buffer>;
  remove(path: string): Promise<void>;
  list(prefix: string, paginationToken?: string): Promise<StorageListing>;
};
