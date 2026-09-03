# Next.js Static Assets with Tigris

## Custom Asset Prefix

```javascript
// next.config.js
module.exports = {
  assetPrefix:
    process.env.NODE_ENV === "production"
      ? "https://my-app-assets.t3.storage.dev"
      : undefined,
};
```

## Deploy Script

```bash
# After `next build`, upload _next/static to Tigris
tigris cp .next/static/ t3://my-app-assets/_next/static/ -r \
  --cache-control "public, max-age=31536000, immutable"
```
