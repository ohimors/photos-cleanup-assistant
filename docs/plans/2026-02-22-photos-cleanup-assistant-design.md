# Photos Cleanup Assistant — Design Document

**Date:** 2026-02-22
**Status:** Approved
**Scope:** v1 MVP — Date range batch selection

## Overview

A Chrome extension that helps users select Google Photos items by date range for manual cleanup. The extension programmatically selects photos matching criteria, then the user manually executes actions (Download, Delete, Add to Album).

## Goals

- Select up to 2500+ photos in a single batch by date range
- Provide progress feedback during selection
- Store batch history locally
- Safety-first: no automated deletion, user always performs final action

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Extension Popup (popup.html/js)                            │
│  - Create/manage batches                                    │
│  - Set date range, filters                                  │
│  - Start selection, view progress                           │
│  - View batch history                                       │
└─────────────────────┬───────────────────────────────────────┘
                      │ chrome.runtime messages
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Service Worker (background.js)                             │
│  - Stores batches in chrome.storage.local                   │
│  - Coordinates popup ↔ content script communication         │
│  - Manages selection state                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │ chrome.runtime messages
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Content Script (content.js) on photos.google.com/*         │
│  - Reads DOM to find photo elements                         │
│  - Executes scroll-and-select algorithm                     │
│  - Shows progress overlay                                   │
│  - Reports status back to service worker                    │
└─────────────────────────────────────────────────────────────┘
```

**Permissions (Manifest V3):**
- `storage` — for batch history
- `host_permissions: ["https://photos.google.com/*"]` — to inject content script

## User Flow

1. User opens popup → sees "New Batch" button and list of past batches
2. User creates batch: enters name, picks start/end date, clicks "Start Selection"
3. Extension navigates to Google Photos with date filter applied
4. Selection begins with progress overlay: "Selecting photos... 247 selected"
5. User can Pause or Stop at any time
6. Selection complete: Google Photos shows all selected photos
7. User manually clicks Download, Delete, or Add to Album
8. Batch saved to history with metadata

## Selection Algorithm

```
1. Scroll to top of photo grid
2. While not finished:
   a. Find all visible photo elements in viewport
   b. For each photo not yet selected:
      - Click its selection checkbox
      - Wait 50-100ms (throttle)
      - Increment counter
   c. Scroll down by one viewport height
   d. Wait 300-500ms for photos to load
   e. Check if we've reached the end (no new photos)
3. Show completion overlay
```

**Key parameters:**
- Click delay: 50-100ms between selections
- Scroll delay: 300-500ms between scrolls
- End detection: 2-3 scroll attempts with no new photos

**Controls:**
- Pause: stops selection, keeps state, can resume
- Stop: cancels selection, keeps already-selected photos selected

## Data Model

```javascript
{
  "batches": [
    {
      "id": "batch_1708642800000",
      "name": "2021 cleanup",
      "startDate": "2021-01-01",
      "endDate": "2021-12-31",
      "status": "completed",      // pending | in_progress | completed | stopped
      "photosSelected": 2347,
      "createdAt": "2024-02-22T10:00:00Z",
      "completedAt": "2024-02-22T10:15:00Z",
      "notes": ""
    }
  ],
  "settings": {
    "scrollDelay": 400,
    "clickDelay": 75,
    "showProgressOverlay": true
  }
}
```

**Not stored:**
- Photo URLs or IDs
- Image data or thumbnails
- Google account info

## Error Handling

| Scenario | Response |
|----------|----------|
| Google Photos UI changed | Show error: "Unable to find photo elements. Extension may need update." |
| User navigates away | Pause selection, show warning to return |
| Network error | Retry 3 times, then pause with connection message |
| Rate limiting detected | Auto-pause, suggest slower settings |

## Out of Scope (v1)

- Duplicate detection (v2)
- Large video finder (v2)
- Media type filtering (v2)
- Chrome Web Store publication (requires additional polish)

## Security & Privacy

- All processing local
- No data sent to external servers
- No OAuth tokens stored
- User can export/clear all data from options page
- Content Security Policy locked down
- No remote code execution
