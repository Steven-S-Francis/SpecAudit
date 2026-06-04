# Add "Backend file upload" to ROADMAP.md (lowest priority)

## Change

In `ROADMAP.md`, add a new entry under **Large (significant build)** section, after the last existing entry.

## Exact text to add

Insert this block after the "Share link" entry (after line 109 in the current file):

```

### Backend file upload (multipart support)
Accept spec files as multipart/form-data directly to the backend instead of frontend parsing.
- **Why:** Enables larger file sizes; backend can validate YAML/JSON structure before audit.
- **Affects:** NEW `backend/src/Endpoints/FileUploadEndpoint.cs`, `frontend/src/components/features/InputPanel.tsx`, `frontend/src/api/auditClient.ts`.
- **Risk:** Requires backend changes; no textarea preview if user uploads directly.
- **Priority:** Lowest — do not pick before other features are completed.
```

## Verification

Read `ROADMAP.md` after edit and confirm the new entry is present under Large, after "Share link" and before the `---` separator.

## Commit

No commit needed. This is a manual edit.
