# tigris-sdk-guide

Guide for choosing between Tigris-native SDKs and AWS S3-compatible SDKs per language.

## What It Covers

- **Decision table** — which SDK to use per language
- **TypeScript/JS** — `@tigrisdata/storage` (native, preferred)
- **Go** — `github.com/tigrisdata/storage-go` (native, preferred)
- **Python** — `tigris-boto3-ext` (boto3 extension with Tigris features)
- **Ruby** — `aws-sdk-s3` with Tigris endpoint (no native SDK yet)
- **PHP** — `aws-sdk-php` with Tigris endpoint (no native SDK yet)
- **CLI** — `tigris`/`t3` instead of `aws s3` (native, preferred)
- **S3-compatible config** — endpoint, region, path style settings

## Installation

**Claude Code:**

```bash
cp -r skills/tigris-sdk-guide ~/.claude/skills/
```

**claude.ai:**

Add `skills/tigris-sdk-guide` to project knowledge or paste `SKILL.md` contents into the conversation.

## Usage

This skill activates when you mention:

- "Which SDK", "Tigris SDK", "aws-sdk vs tigris"
- "S3 compatible", "boto3 Tigris", "storage-go"
- Setting up Tigris in a new language/framework

## Example Prompts

```text
Should I use the AWS SDK or Tigris SDK for my Node.js app?
```

```text
How do I connect boto3 to Tigris?
```

```text
What's the Go SDK for Tigris?
```

## License

MIT
