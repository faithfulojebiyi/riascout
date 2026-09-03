# TypeScript / JavaScript — Use `@tigrisdata/storage`

```bash
npm install @tigrisdata/storage
```

```typescript
// ✅ Do this — Tigris SDK
import { put, get, remove, list, head, getPresignedUrl } from "@tigrisdata/storage";

await put("file.jpg", data, { contentType: "image/jpeg" });
const result = await get("file.jpg", "string");
await remove("file.jpg");

// ❌ Not this — AWS SDK
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
const s3 = new S3Client({ endpoint: "https://t3.storage.dev", region: "auto" });
await s3.send(new PutObjectCommand({ Bucket: "my-bucket", Key: "file.jpg", Body: data }));
```

**Why Tigris SDK is better:**
- No bucket/region boilerplate — reads from env vars automatically
- Simpler API: `put(path, body)` vs `new PutObjectCommand({Bucket, Key, Body})`
- Built-in client upload support: `handleClientUpload` + `upload()` from `@tigrisdata/storage/client`
- Built-in multipart with progress tracking
- Returns typed `TigrisStorageResponse` with error handling

## Client-Side Uploads

```typescript
// Server: handle presigned URL generation
import { handleClientUpload } from "@tigrisdata/storage";
const { data, error } = await handleClientUpload(requestBody);

// Client: upload directly to Tigris
import { upload } from "@tigrisdata/storage/client";
await upload(filename, file, {
  url: "/api/upload",
  multipart: true,
  onUploadProgress: ({ percentage }) => console.log(percentage),
});
```

## Environment Variables

```bash
TIGRIS_STORAGE_ACCESS_KEY_ID=tid_xxx
TIGRIS_STORAGE_SECRET_ACCESS_KEY=tsec_yyy
TIGRIS_STORAGE_ENDPOINT=https://t3.storage.dev
TIGRIS_STORAGE_BUCKET=my-app-uploads
```
