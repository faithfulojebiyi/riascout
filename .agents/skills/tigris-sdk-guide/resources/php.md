# PHP — aws-sdk-php (No Native SDK Yet)

There is no native Tigris PHP SDK. Use `aws-sdk-php` or `league/flysystem-aws-s3-v3` pointed at Tigris.

```php
$s3 = new Aws\S3\S3Client([
    'endpoint' => 'https://t3.storage.dev',
    'region' => 'auto',
    'version' => 'latest',
    'use_path_style_endpoint' => true,
    'credentials' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
    ],
]);
```

## Framework Integration

**Laravel:** S3 disk driver in `filesystems.php` — set `endpoint` and `use_path_style_endpoint: true`
