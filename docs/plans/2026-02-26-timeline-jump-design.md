# Timeline Jump Feature — Design Document

**Date:** 2026-02-26
**Status:** Approved
**Scope:** Quick navigation to target date before scanning

## Problem

Users with large photo libraries (spanning 10-20 years) experience very long scroll times when selecting photos from older date ranges. The extension currently starts from the top (newest photos) and scrolls through everything to reach the target date range.

## Solution

Use Google Photos' native date scrubber to jump directly to the target year before starting the selection scan.

## How It Works

### User Flow (unchanged)

1. User opens extension modal
2. Sets date range: e.g., from "Jan 1, 2020" to "Dec 31, 2020"
3. Clicks "Start Selection"
4. **NEW:** Extension jumps to 2020 in the timeline
5. Selection scan begins from that position
6. Scan stops when passing the "from date"

### Technical Approach

**Google Photos Date Scrubber Structure:**
```
div.scwMhd (scrubber container)
  └── div.HrGXnb (year label, clickable) → "2026"
  └── div.KALWyc (month tick marks)
  └── div.HrGXnb (year label, clickable) → "2025"
  └── ...
```

**New function: `jumpToYear(year)`**
1. Find scrubber: `document.querySelector('div.scwMhd')` or `[jsname="K0co3b"]`
2. Find year elements: `scrubber.querySelectorAll('.HrGXnb')`
3. Find element matching target year
4. Click it to trigger Google's native navigation
5. Wait for photos to load (use existing `waitForMetadataLoaded()`)

**Modified `startSelection()`**
```javascript
async function startSelection() {
  // ... existing setup ...

  // NEW: Jump to target year if "to date" is set
  if (filters.dateRange.to) {
    const targetYear = new Date(filters.dateRange.to).getFullYear();
    await jumpToYear(targetYear);
  }

  // Existing: wait for metadata, run selection loop
  await waitForMetadataLoaded();
  await runSelectionLoop();
}
```

## Selectors

| Element | Primary Selector | Fallback |
|---------|-----------------|----------|
| Scrubber container | `div.scwMhd` | `[jsname="K0co3b"]` |
| Year labels | `.HrGXnb` | — |

## Error Handling

| Scenario | Response |
|----------|----------|
| Scrubber not found | Log warning, fall back to scroll-from-top |
| Target year not in scrubber | Click nearest available year |
| Click doesn't navigate | Fall back to scroll-from-top |

## Testing

1. Set date range to old year (e.g., 2015), verify jump works
2. Set date range with no "to date", verify starts from top
3. Test with year that has no photos, verify graceful fallback

## Out of Scope

- Month-level precision jumping (years are sufficient for initial implementation)
- Drag-based scrubber interaction (clicking year labels is simpler)
