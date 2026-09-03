# tigris-egress-optimizer

Diagnose and fix excessive storage egress (bandwidth) costs with a 4-step framework.

## What It Covers

- **Diagnose** — identify high-bandwidth buckets and access patterns
- **Analyze** — codebase anti-pattern checklist (proxying, missing cache headers, metadata fetching)
- **Fix** — Cache-Control headers, public bucket CDN, presigned URLs, thumbnails, ETags, regional pinning
- **Verify** — monitor bandwidth reduction and set alerts

## Installation

**Claude Code:**

```bash
cp -r skills/tigris-egress-optimizer ~/.claude/skills/
```

**claude.ai:**

Add `skills/tigris-egress-optimizer` to project knowledge or paste `SKILL.md` contents into the conversation.

## Usage

This skill activates when you mention:

- "Egress costs", "bandwidth costs", "high storage bill"
- "Reduce data transfer", "CDN optimization"
- "Cache headers", "why is my bill high"

## Example Prompts

```text
My Tigris bandwidth costs are high, help me diagnose why
```

```text
Optimize my app to reduce storage egress
```

```text
Add proper caching headers for files stored in Tigris
```

## License

MIT
