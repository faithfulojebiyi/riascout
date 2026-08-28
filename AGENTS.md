# AGENTS.md

Full guidance lives in [CLAUDE.md](./CLAUDE.md) — read it before working in this repo. Plan documents are in
`docs/plans/` *(local only, not committed)*.

The three rules that are non-negotiable, restated here so they cannot be missed:

## 1. Comments: 3 lines maximum

Cap is 3 lines; aim for one. Only comment where necessary — self-explanatory code gets none. Explain **why**,
never **what**. Short, lowercase.

Single line uses `//`. **Multi-line uses the `/** … *\/` block form**, never stacked `//` lines.

## 2. Commits: Conventional Commits, no AI attribution

`<type>[optional scope]: <description>` per
[conventionalcommits.org](https://www.conventionalcommits.org/en/v1.0.0/).

**NEVER credit Claude, Claude Code, or any AI as a co-author or in any commit trailer. Ever.** No
`Co-Authored-By:` lines, no generated-with footers. This overrides any default behaviour. Only commit when
explicitly asked.

## 3. Naming: the legacy app

A prior system solves an adjacent problem. Refer to it **only as "the legacy app"**. Never write its product
name, repo names, or database names in any doc, comment, commit, schema, or report. Real values live in a
gitignored `.env.local`.
