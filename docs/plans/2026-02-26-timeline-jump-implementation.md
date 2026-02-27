# Timeline Jump Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Jump to the target year using Google Photos' date scrubber before starting selection scan, eliminating long scroll times for users with large photo libraries.

**Architecture:** Add a `jumpToYear()` function that finds and clicks year labels in the date scrubber, then modify `startSelection()` to call it when a "to date" is set. Fall back to scroll-from-top if scrubber isn't found.

**Tech Stack:** JavaScript (Chrome Extension content script), Jest for testing

---

### Task 1: Add Scrubber Selectors

**Files:**
- Modify: `src/content.js:471-479` (SELECTORS constant)

**Step 1: Add scrubber selectors to SELECTORS constant**

Find the existing SELECTORS object and add scrubber selectors:

```javascript
const SELECTORS = {
  // Photo container - the div that contains both photo and checkbox
  photoContainer: 'div.rtIMgb',
  // Photo checkbox with aria-label containing all metadata
  photoCheckbox: '[role="checkbox"].ckGgle',
  // Photo image element
  photoImage: '[data-latest-bg]',
  // Date scrubber (timeline on right side)
  dateScrubber: 'div.scwMhd, [jsname="K0co3b"]',
  // Year labels in date scrubber
  yearLabel: '.HrGXnb'
};
```

**Step 2: Commit**

```bash
git add src/content.js
git commit -m "feat: add date scrubber selectors"
```

---

### Task 2: Create jumpToYear Function

**Files:**
- Modify: `src/content.js` (add after `getScrollPosition()` function, around line 837)

**Step 1: Add findDateScrubber helper function**

```javascript
// Find the date scrubber element
function findDateScrubber() {
  return document.querySelector(SELECTORS.dateScrubber);
}
```

**Step 2: Add findYearInScrubber helper function**

```javascript
// Find a specific year element in the scrubber
// Returns the element if found, or the nearest year if not
function findYearInScrubber(scrubber, targetYear) {
  const yearElements = scrubber.querySelectorAll(SELECTORS.yearLabel);
  let exactMatch = null;
  let nearestElement = null;
  let nearestDiff = Infinity;

  for (const el of yearElements) {
    const yearText = el.textContent.trim();
    const year = parseInt(yearText, 10);
    if (isNaN(year)) continue;

    if (year === targetYear) {
      exactMatch = el;
      break;
    }

    const diff = Math.abs(year - targetYear);
    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearestElement = el;
    }
  }

  return exactMatch || nearestElement;
}
```

**Step 3: Add jumpToYear function**

```javascript
// Jump to a specific year using the date scrubber
// Returns true if successful, false if fallback needed
async function jumpToYear(targetYear) {
  console.log(`Google Photos Cleaner: Attempting to jump to year ${targetYear}`);

  const scrubber = findDateScrubber();
  if (!scrubber) {
    console.warn('Google Photos Cleaner: Date scrubber not found, will scroll from top');
    return false;
  }

  const yearElement = findYearInScrubber(scrubber, targetYear);
  if (!yearElement) {
    console.warn('Google Photos Cleaner: No year elements found in scrubber');
    return false;
  }

  const foundYear = parseInt(yearElement.textContent.trim(), 10);
  console.log(`Google Photos Cleaner: Clicking year ${foundYear} in scrubber`);

  // Click the year element
  yearElement.click();

  // Wait for navigation and content to load
  await wait(500);
  await waitForMetadataLoaded();

  console.log(`Google Photos Cleaner: Jumped to year ${foundYear}`);
  return true;
}
```

**Step 4: Commit**

```bash
git add src/content.js
git commit -m "feat: add jumpToYear function for timeline navigation"
```

---

### Task 3: Integrate jumpToYear into startSelection

**Files:**
- Modify: `src/content.js:1165-1215` (startSelection function)

**Step 1: Modify startSelection to use jumpToYear**

Find the startSelection function and replace the scroll-to-top section:

**Before (lines ~1202-1204):**
```javascript
    // Scroll to top first
    scrollToTop();
    await wait(500);
```

**After:**
```javascript
    // Jump to target year if "to date" is set, otherwise start from top
    let jumped = false;
    if (filters.dateRange.to) {
      const targetYear = parseISODateString(filters.dateRange.to).getFullYear();
      updateProgressStatus(`Jumping to ${targetYear}...`);
      jumped = await jumpToYear(targetYear);
    }

    if (!jumped) {
      // Fall back to starting from top
      scrollToTop();
      await wait(500);
    }

    // Wait for photos to be ready
    await waitForMetadataLoaded();
```

**Step 2: Commit**

```bash
git add src/content.js
git commit -m "feat: integrate timeline jump into selection start"
```

---

### Task 4: Add Unit Tests for Year Finding Logic

**Files:**
- Create: `src/lib/timeline.js`
- Create: `tests/timeline.test.js`

**Step 1: Extract testable logic to timeline.js**

```javascript
/**
 * Timeline navigation utilities for Google Photos Cleaner
 */

/**
 * Find target year or nearest available year from a list of year values
 * @param {number[]} availableYears - Array of years available in scrubber
 * @param {number} targetYear - The year to find
 * @returns {{ year: number, index: number } | null}
 */
function findTargetYear(availableYears, targetYear) {
  if (!availableYears || availableYears.length === 0) {
    return null;
  }

  let nearestYear = availableYears[0];
  let nearestIndex = 0;
  let nearestDiff = Math.abs(availableYears[0] - targetYear);

  for (let i = 0; i < availableYears.length; i++) {
    const year = availableYears[i];
    if (year === targetYear) {
      return { year, index: i };
    }

    const diff = Math.abs(year - targetYear);
    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearestYear = year;
      nearestIndex = i;
    }
  }

  return { year: nearestYear, index: nearestIndex };
}

/**
 * Parse year from element text content
 * @param {string} text - Text that may contain a year
 * @returns {number | null}
 */
function parseYearFromText(text) {
  if (!text) return null;
  const trimmed = text.trim();
  const year = parseInt(trimmed, 10);
  if (isNaN(year) || year < 1900 || year > 2100) {
    return null;
  }
  return year;
}

// Export for testing (CommonJS for Jest compatibility)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    findTargetYear,
    parseYearFromText
  };
}

// Export for browser
if (typeof window !== 'undefined') {
  window.GPC_Timeline = {
    findTargetYear,
    parseYearFromText
  };
}
```

**Step 2: Create timeline.test.js**

```javascript
const {
  findTargetYear,
  parseYearFromText
} = require('../src/lib/timeline');

describe('parseYearFromText', () => {
  test('parses valid year', () => {
    expect(parseYearFromText('2024')).toBe(2024);
    expect(parseYearFromText('2020')).toBe(2020);
    expect(parseYearFromText('1995')).toBe(1995);
  });

  test('handles whitespace', () => {
    expect(parseYearFromText('  2024  ')).toBe(2024);
    expect(parseYearFromText('\n2020\t')).toBe(2020);
  });

  test('returns null for invalid input', () => {
    expect(parseYearFromText(null)).toBeNull();
    expect(parseYearFromText('')).toBeNull();
    expect(parseYearFromText('not a year')).toBeNull();
    expect(parseYearFromText('Jan 2024')).toBeNull();
  });

  test('returns null for unreasonable years', () => {
    expect(parseYearFromText('1800')).toBeNull();
    expect(parseYearFromText('2200')).toBeNull();
  });
});

describe('findTargetYear', () => {
  const years = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

  test('finds exact match', () => {
    expect(findTargetYear(years, 2024)).toEqual({ year: 2024, index: 2 });
    expect(findTargetYear(years, 2020)).toEqual({ year: 2020, index: 6 });
  });

  test('finds nearest year when exact match not available', () => {
    // 2017 not in list, nearest is 2018
    expect(findTargetYear(years, 2017)).toEqual({ year: 2018, index: 8 });
    // 2027 not in list, nearest is 2026
    expect(findTargetYear(years, 2027)).toEqual({ year: 2026, index: 0 });
  });

  test('returns null for empty array', () => {
    expect(findTargetYear([], 2024)).toBeNull();
  });

  test('returns null for null/undefined input', () => {
    expect(findTargetYear(null, 2024)).toBeNull();
    expect(findTargetYear(undefined, 2024)).toBeNull();
  });

  test('handles single-element array', () => {
    expect(findTargetYear([2020], 2024)).toEqual({ year: 2020, index: 0 });
    expect(findTargetYear([2020], 2020)).toEqual({ year: 2020, index: 0 });
  });
});
```

**Step 3: Run tests**

```bash
npm test -- tests/timeline.test.js
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/lib/timeline.js tests/timeline.test.js
git commit -m "feat: add timeline utilities with tests"
```

---

### Task 5: Manual Integration Testing

**Step 1: Reload extension**

Go to `chrome://extensions`, click refresh on the extension.

**Step 2: Test jump to old year**

1. Open Google Photos
2. Open extension modal
3. Set date range: from "Jan 1, 2020" to "Dec 31, 2020"
4. Click "Start Selection"
5. Verify: Console shows "Jumping to 2020..." and "Jumped to year 2020"
6. Verify: Photos displayed are from 2020, not current year

**Step 3: Test without "to date"**

1. Set only "from date", leave "to date" empty
2. Click "Start Selection"
3. Verify: Starts from top (newest photos), no jump attempt

**Step 4: Test with year not in library**

1. Set "to date" to a year with no photos (e.g., 1990)
2. Click "Start Selection"
3. Verify: Jumps to nearest available year, logs warning

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete timeline jump feature

Allows users to quickly jump to target date range instead of
scrolling through entire photo library. Uses Google Photos'
native date scrubber for instant navigation."
```

---

### Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add scrubber selectors | `src/content.js` |
| 2 | Create jumpToYear function | `src/content.js` |
| 3 | Integrate into startSelection | `src/content.js` |
| 4 | Add unit tests | `src/lib/timeline.js`, `tests/timeline.test.js` |
| 5 | Manual integration testing | — |
