# claude.md — Photos Cleanup Assistant (Chrome Extension)

## Product name
Photos Cleanup Assistant

## One-line description
A privacy-first Chrome extension that helps users *identify* (select all photos that match criteria) Google Photos items to clean up (date-range batches, duplicates, large videos), then guides them through a safe, manual delete workflow in Google Photos.

## Why this exists
Google Photos does not provide a public API to delete media items from a user’s library. The official APIs support limited album management (e.g., removing media items from albums under constraints) but not true library deletion. Therefore, this product is intentionally designed as a *review + guided cleanup* tool, not an automated deletion bot. (Avoids high-risk automation patterns and aligns with Chrome Web Store policies.) 

## Goals (must-haves)
1. Help users find media candidates by:
   - Date range (e.g., “Jan 1–Jan 31, 2022”)
   - Media type (photo/video)
   - Large items (e.g., videos above X MB) — best-effort via UI metadata or local heuristics
   - Duplicates (perceptual hash on downloaded thumbnails where possible; see constraints)
2. Build a “Review Queue”:
   - User creates a named batch (e.g., “Takeout zips 2021-09”)
   - Batch stores lightweight identifiers only (no raw photos)
3. Safety-first workflow:
   - No background deletion
   - No automated clicking of delete/trash
   - User must manually confirm deletion in Google Photos UI
   - Provide step-by-step on-screen overlay instructions and checklists
4. Privacy:
   - Local-first processing
   - No uploading of photo content
   - Minimal permissions
   - Clear data disclosure and privacy policy copy
5. - The end state should be a set of photos that are selected based on the search criteria

## Non-goals (explicitly out of scope)
- Automated deletion of Google Photos library items.
- Calling undocumented internal Google Photos endpoints.
- Any workflow that “acts as the user” to click UI delete/trash at scale.
- Collection of browsing history or unrelated webpage content.

## Compliance constraints (Chrome Web Store)
- Follow Chrome Web Store Program Policies and “Limited Use” principles:
  - Request only the minimal permissions needed
  - Use collected data only for the disclosed, user-facing feature
  - Avoid collecting browsing activity except what is essential and clearly disclosed
  - Provide clear privacy disclosures on the store page and in-product UI
- Avoid behaviors that look like credential harvesting, stealth automation, or account takeover patterns.

## Supported functionality (v1)
### A) “Batch Builder” (core)
- User selects:
  - A date range
  - A media type filter
  - Optional “suspected duplicates” toggle
- Extension creates a batch with:
  - Title
  - Range
  - Count estimate
  - Notes
- Provides a “Launch Google Photos” button and a checklist overlay:
  - Search/filter instructions
  - How to multi-select
  - How to move items to trash manually
  - Reminder to review trash and retention windows


## Technical approach (Manifest V3)
### Architecture
- `service_worker` (background): stores user batches, handles settings, no scraping.
- `content_script` on `https://photos.google.com/*`:
  - Reads only necessary UI elements (dates, visible thumbnails) to build review suggestions.
  - Renders non-intrusive overlay UI for batch instructions and duplicate clustering.
- `options.html`: privacy controls, export/delete local data, disclosures.

### Data storage
- Use `chrome.storage.local` only.
- Store:
  - Batch metadata (date range, user notes)
  - Lightweight item references where feasible (e.g., stable DOM-derived IDs if present)
  - Perceptual hashes of thumbnails (not the images)
- Never store:
  - Full-resolution images
  - OAuth tokens (unless absolutely required; prefer no OAuth)

### Permissions (minimal)
- `storage`
- `activeTab` (preferred over broad host permissions)
- Host permissions limited to `https://photos.google.com/*` only if necessary
- Avoid `tabs` permission unless needed

## UX principles
- Clear “This extension does not delete for you” messaging.
- “Safety rails”:
  - “Dry run” style previews only
  - Confirmation prompts for any destructive *recommendations*
- Explain purge/trash retention and remind user to verify.

## Security model
- No remote code execution (no loading scripts from CDNs).
- Content Security Policy locked down.
- All processing local.
- Provide “Export/Erase my data” in settings.
- Provide a security contact email.

## Monetization (Web Store)
- Freemium:
  - Free: date range batching + basic checklist
  - Pro: duplicate clustering + large-item heuristics + saved batch templates
- No subscription required for core safety features.
- Use Stripe in a separate web app, or Chrome Web Store payments where available (keep tokens off extension).

## Store listing requirements
- Accurate description: “Guides manual cleanup; does not auto-delete”
- Prominent privacy disclosures:
  - What data is accessed on photos.google.com
  - What is stored locally
  - What is never collected
- Link to privacy policy and support page.

## Test plan
- Verify no actions occur without explicit user clicks.
- Regression checks on:
  - Google Photos UI changes (selectors)
  - Performance on large libraries (limit to visible items only)
- Security tests:
  - Ensure no data leaves the device
  - Confirm no broad URL access beyond photos.google.com

## Future (v2+)
- Optional companion desktop app that imports Google Takeout archives and produces cleanup “plans”
- Optional Drive-based workflows (since Drive APIs support file operations more fully than Photos)

## Deliverables in repo
- `manifest.json` (MV3)
- `service_worker.js`
- `content_script.js`
- `ui/overlay.html`, `ui/overlay.css`
- `options.html`, `options.js`
- `PRIVACY.md`
- `SECURITY.md`
- `README.md` with explicit non-deletion stance and safe-use instructions
