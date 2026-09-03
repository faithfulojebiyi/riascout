# Ruby — aws-sdk-s3 (No Native SDK Yet)

There is no native Tigris Ruby SDK. Use `aws-sdk-s3` pointed at Tigris.

```ruby
# Gemfile
gem "aws-sdk-s3"
```

```ruby
require "aws-sdk-s3"

s3 = Aws::S3::Client.new(
  endpoint: "https://t3.storage.dev",
  region: "auto",
  access_key_id: ENV["AWS_ACCESS_KEY_ID"],
  secret_access_key: ENV["AWS_SECRET_ACCESS_KEY"],
  force_path_style: true,
)

# Upload
s3.put_object(bucket: "my-bucket", key: "file.jpg", body: File.open("file.jpg"))
```

## Framework Integration

**Rails:** Active Storage with S3 service — set `endpoint` and `force_path_style: true` in `storage.yml`
