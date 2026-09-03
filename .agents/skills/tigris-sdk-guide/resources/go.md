# Go — Use `github.com/tigrisdata/storage-go`

```bash
go get github.com/tigrisdata/storage-go
```

Two packages available:

## simplestorage (High-Level)

```go
// ✅ Do this — Tigris SDK
import "github.com/tigrisdata/storage-go/simplestorage"

client, err := simplestorage.New(ctx)
err = client.PutObject(ctx, "my-bucket", "file.jpg", reader)
obj, err := client.GetObject(ctx, "my-bucket", "file.jpg")
```

## storage (Full S3 + Tigris Extras)

```go
// ✅ Full client with Tigris-specific features
import "github.com/tigrisdata/storage-go/storage"

client, err := storage.New(ctx)

// Standard S3 operations work
client.PutObject(ctx, &s3.PutObjectInput{...})

// Plus Tigris-specific features:
client.CreateBucketSnapshot(ctx, "my-bucket")
client.CreateBucketFork(ctx, "my-bucket", "my-fork")
client.RenameObject(ctx, "my-bucket", "old-key", "new-key")  // in-place, no copy!
```

**Tigris-only Go features not in AWS SDK:**
- `CreateBucketSnapshot` / `ListBucketSnapshots`
- `CreateBucketFork` / `ListBucketForks`
- `RenameObject` (in-place rename, no copy+delete needed)

## Environment Variables

```bash
AWS_ACCESS_KEY_ID=tid_xxx
AWS_SECRET_ACCESS_KEY=tsec_yyy
AWS_ENDPOINT_URL_S3=https://t3.storage.dev
AWS_REGION=auto
```
