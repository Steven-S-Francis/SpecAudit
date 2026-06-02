# SpecAudit — Feature Roadmap

> Maintained at `ROADMAP.md`. Update as features are completed.

## ✅ Completed

| Feature | Commit |
|---------|--------|
| Copy to Clipboard | `0730715` |
| Export as Markdown (Download) | `76d167e` |
| Rate-limit retry | `9c2c58e` |
| Auto-scroll results | `85c9661` |
| Dark mode / Light mode toggle | `598fe56` |
| Input character counter | Step 7 |
| CI for PRs | `5a2e250` |
| Ship agent (pipeline orchestrator) | `.opencode/agents/ship.md` |
| Error UX (inline validation, status cards) | Step 7 + Step 9 |

---

## Small (quick wins)

- **Export as PDF** — Generate a downloadable PDF report from the audit result
- **Export as JSON** — Download raw audit result as structured JSON
- **Severity filter** — Toggle buttons to show/hide CRITICAL / WARNING / INFO findings
- **Search within results** — Inline search input that highlights/filters audit output text
- **Copy individual finding** — Click a copy icon on a single severity block to copy just that finding
- **Keyboard shortcuts** — `Ctrl+Enter` to submit, `Escape` to stop streaming
- **Spec file upload** — Drag-and-drop or file picker for YAML/JSON spec files (instead of paste-only)

## Medium (more involved)

- **Session history** — Persist past audits in `localStorage`, show a sidebar/list to browse and re-open previous results
- **Audit history sidebar** — Persistent collapsible sidebar listing recent audits with date/summary
- **Toast/snackbar system** — Non-blocking notifications for transient events (network errors, copy success, rate-limit backoff)
- **Configurable provider/model in UI** — Dropdown in the header to switch between Groq, Together AI, etc. without editing `appsettings.json`
- **Expandable findings** — Collapse/expand findings grouped by severity for easier navigation in long reports

## Large (significant build)

- **Spec comparison** — Upload two OpenAPI specs; diff their audit results side by side
- **Database-backed persistence** — Store specs + results in Postgres (Railway add-on) instead of localStorage
- **OpenAPI spec validation** — Parse and structurally validate the spec client-side before sending to AI; show pre-submit errors
- **GitHub App / webhook** — Auto-audit OpenAPI specs in PRs when they change
- **Share link** — Generate a unique shareable URL for an audit result

## Infrastructure

- **Staging environment** — Separate Railway project for pre-prod testing
- **Custom domain** — Point a real domain to the Railway app
- **Monitoring / error tracking** — Uptime check + Sentry integration
