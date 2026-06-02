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
| Export as PDF | *(re-implemented with pdfmake, replacing html2pdf.js)* |
| Integration tests (real OpenAPI fixtures) | `517968b` |
| Export as JSON | `8145305` |

---

## Small (quick wins)

### Severity filter
Toggle buttons to show/hide CRITICAL / WARNING / INFO findings in the result panel.
- **Why:** Large audit reports are easier to triage when you can focus on CRITICALs only.
- **Affects:** `frontend/src/components/features/ResultPanel.tsx` (filter state + conditional rendering), `frontend/src/App.tsx` (pass filter state).
- **Risk:** Filter must not interfere with streaming — should only apply once complete, or apply dynamically.

### Search within results
Inline search input that highlights/filters audit output text.
- **Why:** Users hunting for a specific path or finding in a long report.
- **Affects:** `frontend/src/components/features/ResultPanel.tsx` (search input + highlight logic).
- **Risk:** Performance on large reports if re-rendering on every keystroke; debounce needed.

### Copy individual finding
Click a copy icon on a single severity block to copy just that finding.
- **Why:** Users often want to share a specific finding, not the entire report.
- **Affects:** `frontend/src/components/features/ResultPanel.tsx` (copy icon per severity div).
- **Risk:** Must use `navigator.clipboard.writeText` with the finding's plain text; match existing copy pattern.

### Keyboard shortcuts
`Ctrl+Enter` to submit the audit, `Escape` to stop streaming.
- **Why:** Power users prefer keyboard over mouse — faster iteration.
- **Affects:** `frontend/src/App.tsx` (global keydown listener), `frontend/src/components/features/InputPanel.tsx` (Ctrl+Enter).
- **Risk:** Must not interfere with normal textarea input (e.g., multi-line text entry).

### Spec file upload
Drag-and-drop or file picker for YAML/JSON spec files, instead of paste-only input.
- **Why:** Users have spec files on disk; pasting large specs is error-prone.
- **Affects:** `frontend/src/components/features/InputPanel.tsx` (file input + drag zone), `frontend/src/App.tsx` (pass file content).
- **Risk:** File reading is async; need loading state while reading. Must handle non-YAML/JSON files gracefully.

---

## Medium (more involved)

### Session history
Persist past audits in `localStorage`, show a sidebar/list to browse and re-open previous results.
- **Why:** Users run multiple audits and want to reference past results without re-running.
- **Affects:** NEW `frontend/src/hooks/useHistory.ts` (CRUD on localStorage), `frontend/src/components/features/HistorySidebar.tsx` (list UI), `frontend/src/App.tsx` (wire sidebar + load on click).
- **Risk:** localStorage has a ~5MB limit; large specs + results may hit it. Need LRU eviction or size warning.

### Audit history sidebar
Persistent collapsible sidebar listing recent audits with date/summary.
- **Why:** Quick access to past audits without modal popups or page navigation.
- **Affects:** NEW `frontend/src/components/features/HistorySidebar.tsx`, `frontend/src/App.tsx` (layout shift to accommodate sidebar), new `useHistory` hook (shared with session history).
- **Risk:** Layout shift on mobile — sidebar may need to be a modal/drawer on small screens.

### Toast/snackbar system
Non-blocking notifications for transient events (network errors, copy success, rate-limit backoff).
- **Why:** Current error display is a static card — users may miss transient events during streaming.
- **Affects:** NEW `frontend/src/components/ui/Toast.tsx`, `frontend/src/App.tsx` (toast state + render).
- **Risk:** Toast stacking (multiple simultaneous toasts) and auto-dismiss timing.

### Configurable provider/model in UI
Dropdown in the header to switch between Groq, Together AI, etc. without editing `appsettings.json`.
- **Why:** Users want to compare different models/providers without server-side config changes.
- **Affects:** `frontend/src/App.tsx` (dropdown + provider state), `frontend/src/api/auditClient.ts` (pass selected provider in request body), `backend/src/Endpoints/AuditEndpoints.cs` (accept provider param, create dynamic client).
- **Risk:** Backend currently uses a single singleton `OpenAIClient` — switching providers at runtime requires factory pattern or disposing/recreating the client.

### Expandable findings
Collapse/expand findings grouped by severity for easier navigation in long reports.
- **Why:** Long reports with 20+ findings are hard to scan; grouping by severity with collapse saves vertical space.
- **Affects:** `frontend/src/components/features/ResultPanel.tsx` (group state + transition), add `useState` for each severity group.
- **Risk:** Animations must be performant during streaming; maybe only enable collapsing when complete.

---

## Large (significant build)

### Spec comparison
Upload two OpenAPI specs; diff their audit results side by side.
- **Why:** Compare "before vs after" when refactoring an API — did the new spec introduce regressions?
- **Affects:** NEW `frontend/src/components/features/ComparePanel.tsx`, `frontend/src/App.tsx` (routing or tab between audit/compare modes), `backend` may need a diff endpoint.
- **Risk:** Requires both specs to be audited simultaneously (or store first result). Side-by-side diff of narrative markdown is non-trivial.

### Database-backed persistence
Store specs + results in Postgres (Railway add-on) instead of localStorage.
- **Why:** Persist beyond browser; share audits across devices; larger storage than localStorage's 5MB.
- **Affects:** NEW `backend/src/Services/AuditStorageService.cs`, NEW `backend/src/Models/`, `backend/Program.cs` (register EF Core + Postgres), `frontend/src/api/auditClient.ts` (new endpoints for listing/loading).
- **Risk:** Adds a database dependency — schema migrations, connection management, Railway Postgres add-on cost.

### OpenAPI spec validation
Parse and structurally validate the spec client-side before sending to AI; show pre-submit errors.
- **Why:** Catch syntax errors early — no point sending malformed YAML to the AI. Saves a round-trip.
- **Affects:** NEW `frontend/src/utils/validateSpec.ts` (YAML/JSON parse + structural checks), `frontend/src/components/features/InputPanel.tsx` (validation error display).
- **Risk:** Full OpenAPI validation is complex; a simple parse + required-field check is a good start.

### GitHub App / webhook
Auto-audit OpenAPI specs in PRs when they change.
- **Why:** Shift-left — catch API design issues before they merge, not after.
- **Affects:** NEW backend endpoint for webhook, GitHub App manifest, NEW `backend/src/Services/GitHubWebhookService.cs`, CI config update.
- **Risk:** Webhook security (verify signature), rate-limit management, PR comment formatting. Significant infra work.

### Share link
Generate a unique shareable URL for an audit result.
- **Why:** Share findings with team members without screenshots or copy-paste.
- **Affects:** NEW backend endpoint `POST /api/share` (stores result, returns slug), NEW `frontend/src/api/auditClient.ts` (share call), `frontend/src/App.tsx` (share button).
- **Risk:** If no database, need ephemeral storage (in-memory cache, file-based). Audit results can be large.

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

### Monitoring / error tracking
Uptime check + Sentry integration.
- **Why:** Proactive detection of outages and errors before users report them.
- **Affects:** Sentry SDK in both backend (`dotnet add package Sentry`) and frontend (`npm install @sentry/react`). Railway health check endpoint.
- **Risk:** Sentry may capture API keys if not sanitized; need to configure data scrubbing.
