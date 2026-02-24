# Photos Cleanup Assistant — In-Page Overlay Redesign

**Date:** 2026-02-23
**Status:** Approved
**Scope:** v1 — Full filter set with in-page overlay UI

## Overview

A Chrome extension that injects a button into the Google Photos header. Clicking the button opens an in-page modal overlay where users can filter photos by type, date range, and orientation. On submission, the extension auto-scrolls through the page and selects all matching photos. The user never leaves the Google Photos page.

## Goals

- Inject trigger button into Google Photos header
- Provide in-page modal overlay with filter controls
- Support filtering by: file type (photos/videos/RAW), date range, orientation
- Auto-scroll and select matching photos with progress feedback
- Keep user on the same page throughout the process
- No freemium gating in v1 — all features free

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  Google Photos Page (photos.google.com)                            │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Google Photos Header                                         │  │
│  │  [Logo] [Search...                    ] [+] [Cleaner Button] │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Photo Grid                                                   │  │
│  │  Photos organized by date headers                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Shadow DOM Container (injected by extension)                 │  │
│  │  - Modal Overlay (filters + progress)                         │  │
│  │  - Toast notifications                                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Why Shadow DOM?

CSS isolation prevents Google Photos styles from breaking our UI. The overlay renders consistently regardless of Google's CSS changes.

### Extension Files

| File | Role |
|------|------|
| `manifest.json` | MV3 manifest with minimal permissions |
| `src/content.js` | Injects UI, handles selection logic |
| `src/styles.css` | Overlay styles (loaded into Shadow DOM) |
| `src/background.js` | Service worker for preference storage |

### Permissions

- `storage` — Store user preferences
- `host_permissions: ["https://photos.google.com/*"]` — Inject content script

## UI Components

### Trigger Button

- Injected into Google Photos header (right side, before profile icon)
- Pill-shaped button: "Google Photos Cleaner" or similar
- Styled to blend with Google's design language

### Modal Overlay

Dark-themed modal with:

1. **Header**: Title + close button
2. **File type toggles**: Photos (default: on), Videos (default: on), RAW (default: off)
3. **Date range**: From/To date pickers
4. **Orientation dropdown**: Any / Landscape / Portrait / Square
5. **Action button**: "Start Selection" (disabled until valid filter set)

### Progress State

When selection runs, modal shows:
- Spinning indicator
- "Selecting..." label
- Live count of selected photos
- "Stop Selection" button

### Toast

After completion:
- Bottom-center notification
- "✓ 2,722 photos selected"
- Auto-dismisses after 4 seconds

## Filter Logic

### Filter State Model

```javascript
{
  fileType: {
    photos: true,
    videos: true,
    raw: false
  },
  dateRange: {
    from: null,  // Date or null
    to: null     // Date or null
  },
  orientation: 'any'  // 'any' | 'landscape' | 'portrait' | 'square'
}
```

### Validation

"Start Selection" is **disabled** when:
- All file types checked AND no date range AND orientation = "any"

This prevents accidental "select everything" operations.

### Filter Detection

| Filter | Detection Method |
|--------|------------------|
| Photos | No video indicator (duration badge, play icon) |
| Videos | Has duration badge or video icon |
| RAW | Filename extension if visible (limited support) |
| Date | Parsed from date header elements in timeline |
| Orientation | Thumbnail dimensions (width vs height comparison) |

## Selection Algorithm

```
1. User clicks "Start Selection"
2. Modal switches to progress state
3. Scroll to top of photo grid
4. LOOP:
   a. Find current date header → extract date
   b. Find all visible photo elements
   c. For each photo:
      - Check if date matches filter
      - Check if file type matches
      - Check if orientation matches
      - If all match AND not already selected → click to select
      - Increment counter, update progress UI
   d. Scroll down one viewport
   e. Wait for photos to load (configurable delay)
   f. If no new photos for 3 consecutive scrolls → END
5. Close modal
6. Show toast with final count
```

### Selection Mechanism

Use Ctrl+Click (or Cmd+Click on Mac) to add photos to selection without deselecting others.

## Stored Preferences

```javascript
{
  preferences: {
    lastUsedFilters: { ... },
    scrollDelay: 400,   // ms between scrolls
    clickDelay: 75      // ms between clicks
  }
}
```

## Error Handling

| Scenario | Response |
|----------|----------|
| Can't find photo elements | Error message: "Unable to find photos. Google may have updated their UI." |
| User closes modal during selection | Stop selection, keep already-selected photos |
| User navigates away | Pause selection |
| No photos match filters | Toast: "No photos matched your filters" |

## Out of Scope (v1)

- Freemium/Pro tiers
- "How it works" tab
- "Select all photos" button
- Duplicate detection
- Batch history/persistence
- Options page (settings via modal instead)

## Security & Privacy

- All processing local to browser
- No data sent to external servers
- No Google credentials accessed
- Minimal permissions requested
- Shadow DOM isolates extension from page

## Visual Design

- Dark theme matching mockup screenshots
- Colors: Dark gray background (#1f2937), blue accents (#3b82f6), green CTA (#22c55e)
- Border radius: 12px for modal, 6px for buttons
- Font: System font stack
