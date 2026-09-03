# Remix Static Assets with Tigris

## Vite Asset Configuration

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    assetsDir: "assets",
  },
  // In production, set base to Tigris bucket URL
  base:
    process.env.NODE_ENV === "production"
      ? "https://my-app-assets.t3.storage.dev/"
      : "/",
});
```

## Deploy Script

```bash
# After build, upload to Tigris
tigris cp build/client/assets/ t3://my-app-assets/assets/ -r \
  --cache-control "public, max-age=31536000, immutable"
```
