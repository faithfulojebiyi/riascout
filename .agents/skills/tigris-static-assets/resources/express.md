# Express Static Assets with Tigris

## Static Redirect Pattern

Instead of serving static files from Express, redirect to Tigris:

```typescript
// For development: serve locally
app.use("/assets", express.static("dist/assets"));

// For production: redirect to Tigris
app.use("/assets", (req, res) => {
  res.redirect(301, `https://my-app-assets.t3.storage.dev/assets${req.path}`);
});
```

## Deploy Script

```bash
# Build and deploy
npm run build
tigris cp dist/assets/ t3://my-app-assets/assets/ -r \
  --cache-control "public, max-age=31536000, immutable"
```
