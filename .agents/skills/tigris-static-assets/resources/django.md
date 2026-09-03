# Django Static Assets with Tigris

> Uses `django-storages` with `tigris-boto3-ext` (install: `pip install django-storages tigris-boto3-ext`).

## collectstatic with S3 Backend

```python
# settings.py
STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
    },
    "staticfiles": {
        "BACKEND": "storages.backends.s3boto3.S3StaticStorage",
    },
}

AWS_S3_ENDPOINT_URL = "https://t3.storage.dev"
AWS_STORAGE_BUCKET_NAME = "my-app-assets"
AWS_S3_CUSTOM_DOMAIN = "my-app-assets.t3.storage.dev"
AWS_DEFAULT_ACL = "public-read"
STATIC_URL = f"https://{AWS_S3_CUSTOM_DOMAIN}/static/"

AWS_S3_OBJECT_PARAMETERS = {
    "CacheControl": "public, max-age=31536000, immutable",
}
```

```bash
python manage.py collectstatic --noinput
```

**Comparison with WhiteNoise:** WhiteNoise serves static files from the app server. Use Tigris instead when you want global CDN delivery without adding load to your application server.
