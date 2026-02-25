# Infinite Scroll Support for Historical Date Ranges

## Problem

Google Photos uses infinite scroll to load photos. When the page loads, only recent photos (1-2 days) are in the DOM. Photos from months or years ago are only accessible by scrolling down. The current implementation stops scrolling too early, making it impossible to select photos from historical date ranges.

## Solution

Enhance the selection loop to continue scrolling until photos older than the target date range are encountered, selecting matching photos along the way.

## Design

### Selection Loop Logic

**Current behavior:**
- Stops after 3 consecutive scrolls with no new photos
- Stops when reaching page bottom

**New behavior:**
1. Track the oldest photo date seen during scrolling
2. Continue scrolling even when no photos match filters (photos may be newer than target range)
3. Stop when oldest photo date is before the "from" date (scrolled past target range)
4. Select matching photos as encountered (scroll-and-select approach)

### Progress UI States

Three distinct phases:

1. **Scanning phase** (before reaching target date range)
   - Label: "Scanning... (viewing: Feb 2025)"
   - Shows current date being scanned
   - Count shows "0" (no selections yet)
   - Spinner active

2. **Selecting phase** (within target date range)
   - Label: "Selecting..."
   - Count shows number of photos selected
   - Spinner active

3. **Completion phase**
   - Label: "Selection complete!" or "No photos matched"
   - Final count displayed
   - "Done" button

### Timeout Handling

For date ranges years in the past, scrolling may take a long time.

**Mechanism:**
- Track start time when selection begins
- After 180 seconds (3 minutes) of scrolling, pause and show prompt
- Prompt offers two options:
  - "Continue Scanning" - resets timer, resumes scrolling
  - "Stop" - ends selection, shows completion state with current count

**Timeout UI:**
```
┌─────────────────────────────┐
│  Scanning taking a while... │
│  Currently viewing: Jan 2024│
│  Photos selected: 5         │
│                             │
│  [Continue Scanning]        │
│  [Stop]                     │
└─────────────────────────────┘
```

### State Management

Updated selection state object:

```javascript
const selection = {
  isRunning: false,
  count: 0,
  shouldStop: false,
  phase: 'scanning',        // 'scanning' | 'selecting' | 'complete'
  currentDateViewing: null, // Date object of most recent photo seen
  startTime: null,          // Timestamp for timeout tracking
  isPaused: false           // For timeout prompt
};
```

**Phase transitions:**
1. Start → `phase: 'scanning'`
2. First photo within date range found → `phase: 'selecting'`
3. Photo older than "from" date OR user stops → `phase: 'complete'`

### Edge Cases

1. **No "from" date specified** (only "to" date)
   - Cannot determine when to stop scrolling
   - Fall back to existing behavior: stop at page bottom or after 3 no-new-photos cycles

2. **Target date range is very recent** (photos already loaded)
   - Skip scanning phase, go directly to selecting
   - Phase starts as 'selecting' if first photos are within range

3. **No photos exist in date range**
   - Scroll until passing the "from" date
   - Show "No photos matched your filters"

4. **User cancels during scanning**
   - Stop immediately
   - Show "Selection stopped" with current count (may be 0)

5. **Page bottom reached before target date**
   - User's library doesn't extend that far back
   - Show completion with whatever was selected

### Files to Modify

- `src/content.js` - Selection loop, UI components, state management

No new files required.

## Success Criteria

1. Date ranges from years ago can be selected
2. Progress shows current date being scanned
3. User can cancel at any time
4. 3-minute timeout prompts user to continue or stop
5. Selection stops automatically when scrolled past target date range
