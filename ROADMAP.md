# SpecAudit Feature Roadmap

> Maintained at `ROADMAP.md`. Update as features are completed.

## âœ… Completed

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
| Export as PDF | *(re-implemented with pdfmake, replacing html2pdf.js)* |
| Integration tests (real OpenAPI fixtures) | `517968b` |
| Export as JSON (basic) | `8145305` (+ trailing newline fix) |
| Structured JSON export (findings + summary objects) | `37b7a0d` |
| Severity filter (show/hide CRITICAL / WARNING / INFO) | `5272c54` |
| Monitoring / error tracking (Sentry) | `ca0312f` |
| Search within results (inline search + highlight) | `679149a` |
| Copy individual finding (per-block copy icon) | `10c9d94` |
| Keyboard shortcuts (Ctrl+Enter, Escape) | `75fd570` |
| Remove NetworkTimeout from OpenAI client (fixes AI streaming hang) | `be75242` |
| Fix AI streaming: don't pass CancellationToken to SDK | `5230ea8` |
| Diagnostic endpoint (GET /api/diagnose → chat/completions) | `4be9fb5`, `e1207a3`, `8c6b3f7` |
| Fresh OpenAI client per request (fixes HTTP/2 connection poisoning) | `7642f2c` |
| Replace OpenAI SDK streaming with raw HttpClient + SSE parsing | `80f5598` |
| Spec file upload (drag-and-drop + file picker) | `a059f4d` |
| Session history (localStorage + sidebar) | `7d90689` |
| Audit history sidebar | `7d90689` |
| Toast/snackbar notification system | `393aa77` |
| Configurable provider/model in UI | `81761c9` |

---

## Small (quick wins)

---

## Medium (more involved)

### Expandable findings
Collapse/expand findings grouped by severity for easier navigation in long reports.
- **Why:** Long reports with 20+ findings are hard to scan; grouping by severity with collapse saves vertical space.
- **Affects:** `frontend/src/components/features/ResultPanel.tsx` (group state + transition), add `useState` for each severity group.
- **Risk:** Animations must be performant during streaming; maybe only enable collapsing when complete.

---

## Large (significant build)

### Spec comparison
Upload two OpenAPI specs; diff their audit results side by side.
- **Why:** Compare "before vs after" when refactoring an API â€” did the new spec introduce regressions?
- **Affects:** NEW `frontend/src/components/features/ComparePanel.tsx`, `frontend/src/App.tsx` (routing or tab between audit/compare modes), `backend` may need a diff endpoint.
- **Risk:** Requires both specs to be audited simultaneously (or store first result). Side-by-side diff of narrative markdown is non-trivial.

### Database-backed persistence
Store specs + results in Postgres (Railway add-on) instead of localStorage.
- **Why:** Persist beyond browser; share audits across devices; larger storage than localStorage's 5MB.
- **Affects:** NEW `backend/src/Services/AuditStorageService.cs`, NEW `backend/src/Models/`, `backend/Program.cs` (register EF Core + Postgres), `frontend/src/api/auditClient.ts` (new endpoints for listing/loading).
- **Risk:** Adds a database dependency â€” schema migrations, connection management, Railway Postgres add-on cost.

### OpenAPI spec validation
Parse and structurally validate the spec client-side before sending to AI; show pre-submit errors.
- **Why:** Catch syntax errors early â€” no point sending malformed YAML to the AI. Saves a round-trip.
- **Affects:** NEW `frontend/src/utils/validateSpec.ts` (YAML/JSON parse + structural checks), `frontend/src/components/features/InputPanel.tsx` (validation error display).
- **Risk:** Full OpenAPI validation is complex; a simple parse + required-field check is a good start.

### GitHub App / webhook
Auto-audit OpenAPI specs in PRs when they change.
- **Why:** Shift-left â€” catch API design issues before they merge, not after.
- **Affects:** NEW backend endpoint for webhook, GitHub App manifest, NEW `backend/src/Services/GitHubWebhookService.cs`, CI config update.
- **Risk:** Webhook security (verify signature), rate-limit management, PR comment formatting. Significant infra work.

### Share link
Generate a unique shareable URL for an audit result.
- **Why:** Share findings with team members without screenshots or copy-paste.
- **Affects:** NEW backend endpoint `POST /api/share` (stores result, returns slug), NEW `frontend/src/api/auditClient.ts` (share call), `frontend/src/App.tsx` (share button).
- **Risk:** If no database, need ephemeral storage (in-memory cache, file-based). Audit results can be large.

### Backend file upload (multipart support)
Accept spec files as multipart/form-data directly to the backend instead of frontend parsing.
- **Why:** Enables larger file sizes; backend can validate YAML/JSON structure before audit.
- **Affects:** NEW `backend/src/Endpoints/FileUploadEndpoint.cs`, `frontend/src/components/features/InputPanel.tsx`, `frontend/src/api/auditClient.ts`.
- **Risk:** Requires backend changes; no textarea preview if user uploads directly.
- **Priority:** Lowest — do not pick before other features are completed.

---

## Infrastructure

### Staging environment
A second Railway project for pre-prod testing before deploying to production.
- **Why:** Catch deployment issues in a safe environment before hitting the live app.
- **Affects:** `.github/workflows/ci.yml` (deploy to staging on PR), Railway dashboard (new project + env vars).
- **Risk:** Additional cost; env var drift between staging and production.

### Custom domain
Point a real domain to the Railway app.
- **Why:** Professional appearance, easier to remember than `*.railway.app`.
- **Affects:** Railway dashboard (domain settings), DNS provider (CNAME record).
- **Risk:** TLS certificate provisioning delay; domain renewal management.


