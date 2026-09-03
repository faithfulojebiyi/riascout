# Python — Use `tigris-boto3-ext`

> For deeper coverage (Django via django-storages, the Bundle API for ML batch fetches, full snapshot/fork/rename usage patterns), use the dedicated **tigris-python-sdk** skill.

The Tigris boto3 extension extends `boto3` with Tigris-specific features (snapshots, forks, renaming). Always install it alongside `boto3`.

```bash
pip install tigris-boto3-ext
```

## Basic Operations

```python
import boto3
from botocore.client import Config

s3 = boto3.client(
    "s3",
    endpoint_url="https://t3.storage.dev",
    aws_access_key_id="tid_xxx",
    aws_secret_access_key="tsec_yyy",
    region_name="auto",
    config=Config(s3={"addressing_style": "virtual"}),
)

# Upload
s3.put_object(Bucket="my-bucket", Key="file.jpg", Body=data)

# Download
response = s3.get_object(Bucket="my-bucket", Key="file.jpg")
content = response["Body"].read()

# Presigned URL
url = s3.generate_presigned_url(
    "get_object",
    Params={"Bucket": "my-bucket", "Key": "file.jpg"},
    ExpiresIn=3600,
)
```

## Tigris-Only Features (via extension)

```python
from tigris_boto3_ext import TigrisSnapshot, TigrisFork

# Snapshots — point-in-time recovery
with TigrisSnapshot(s3, "my-bucket") as snapshot:
    # Work with snapshot version
    obj = snapshot.get_object(Key="file.jpg")

# Forks — isolated copy-on-write clones
with TigrisFork(s3, "my-bucket", "my-fork") as fork:
    # Write to fork without affecting original
    fork.put_object(Key="test.txt", Body=b"experimental data")
```

## Framework Integration

- **Django**: `django-storages` with `S3Boto3Storage` backend + `tigris-boto3-ext`
- **Flask/FastAPI**: `tigris-boto3-ext` directly
