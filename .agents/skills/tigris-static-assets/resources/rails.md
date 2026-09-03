# Rails Static Assets with Tigris

> **Note:** No native Tigris Ruby SDK exists yet. Uses `aws-sdk-s3` pointed at Tigris.

## Sprockets / Propshaft Asset Sync

```ruby
# config/environments/production.rb
config.asset_host = "https://my-app-assets.t3.storage.dev"
```

```ruby
# lib/tasks/assets.rake
namespace :assets do
  desc "Upload compiled assets to Tigris"
  task upload: :environment do
    require "aws-sdk-s3"

    s3 = Aws::S3::Client.new(
      endpoint: "https://t3.storage.dev",
      region: "auto",
      access_key_id: ENV["AWS_ACCESS_KEY_ID"],
      secret_access_key: ENV["AWS_SECRET_ACCESS_KEY"],
    )

    Dir.glob("public/assets/**/*").each do |file|
      next if File.directory?(file)
      key = file.sub("public/", "")
      s3.put_object(
        bucket: ENV["TIGRIS_ASSETS_BUCKET"],
        key: key,
        body: File.open(file),
        content_type: Marcel::MimeType.for(name: file),
        cache_control: "public, max-age=31536000, immutable",
        acl: "public-read",
      )
    end
    puts "Assets uploaded to Tigris"
  end
end
```

```bash
rails assets:precompile && rails assets:upload
```
