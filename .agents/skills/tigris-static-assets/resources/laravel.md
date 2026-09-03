# Laravel Static Assets with Tigris

## Vite / Mix Asset Upload

```php
// config/filesystems.php
'disks' => [
    'assets' => [
        'driver' => 's3',
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => 'auto',
        'bucket' => env('TIGRIS_ASSETS_BUCKET'),
        'endpoint' => 'https://t3.storage.dev',
        'use_path_style_endpoint' => true,
        'visibility' => 'public',
    ],
],
```

```bash
# .env
ASSET_URL=https://my-app-assets.t3.storage.dev
```

## Deploy Script

```bash
npm run build
tigris cp public/build/ t3://my-app-assets/build/ -r \
  --cache-control "public, max-age=31536000, immutable"
```
