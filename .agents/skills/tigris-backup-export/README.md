# tigris-backup-export

Back up databases, export data, and archive files to Tigris with automated pipelines.

## What It Covers

- **Database dumps** — pg_dump/mysqldump to Tigris with compression
- **Node.js** — child_process + node-cron scheduling
- **Rails** — Rake tasks, whenever gem
- **Django** — Management commands, celery-beat
- **Laravel** — Artisan commands, spatie/laravel-backup, Task Scheduling
- **Restore** — Download and restore from backups
- **Retention** — Lifecycle rules for auto-deleting old backups

## Installation

**Claude Code:**

```bash
cp -r skills/tigris-backup-export ~/.claude/skills/
```

**claude.ai:**

Add `skills/tigris-backup-export` to project knowledge or paste `SKILL.md` contents into the conversation.

## Usage

This skill activates when you mention:

- "Backup database", "database dump"
- "Export data", "archive to Tigris"
- "Scheduled backup", "backup retention"

## Example Prompts

```text
Set up automated database backups to Tigris
```

```text
Create a daily backup script for my Rails app
```

```text
Configure backup retention with lifecycle rules
```

## License

MIT
