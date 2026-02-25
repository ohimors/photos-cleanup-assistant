# Infinite Scroll Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable selection of photos from historical date ranges by scrolling through Google Photos' infinite scroll until the target dates are reached.

**Architecture:** Enhance the existing selection loop to track current viewing date, continue scrolling past non-matching photos, and stop when scrolled past the target date range. Add UI feedback showing scan progress and a 3-minute timeout prompt.

**Tech Stack:** Vanilla JavaScript (Chrome Extension content script), CSS-in-JS

---

### Task 1: Update Selection State Object

**Files:**
- Modify: `src/content.js:56-61`

**Step 1: Update the selection state object with new fields**

Find:
```javascript
  // Selection state
  const selection = {
    isRunning: false,
    count: 0,
    shouldStop: false
  };
```

Replace with:
```javascript
  // Selection state
  const selection = {
    isRunning: false,
    count: 0,
    shouldStop: false,
    phase: 'idle',              // 'idle' | 'scanning' | 'selecting' | 'complete'
    currentDateViewing: null,   // Date object of oldest photo seen in current batch
    startTime: null,            // Timestamp for timeout tracking
    isPaused: false             // For timeout prompt
  };
```

**Step 2: Commit**

```bash
git add src/content.js
git commit -m "feat: add phase tracking to selection state"
```

---

### Task 2: Add CSS Styles for Progress States

**Files:**
- Modify: `src/content.js` (inside `getStyles()` function, after `.gpc-validation-hint` styles around line 400)

**Step 1: Add new CSS for progress status and timeout view**

Add before the closing backtick of `getStyles()`:

```css
      /* Progress status text */
      .gpc-progress-status {
        color: #6b7280;
        font-size: 13px;
        margin: 8px 0 0 0;
      }

      /* Timeout prompt */
      .gpc-timeout-view {
        text-align: center;
        padding: 30px 20px;
      }

      .gpc-timeout-title {
        font-size: 18px;
        font-weight: 600;
        color: #f59e0b;
        margin: 0 0 16px 0;
      }

      .gpc-timeout-info {
        color: #9ca3af;
        font-size: 14px;
        margin: 0 0 8px 0;
      }

      .gpc-timeout-buttons {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 24px;
      }

      .gpc-timeout-btn {
        width: 100%;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: background 0.2s;
      }

      .gpc-timeout-btn.continue {
        background: #3b82f6;
        color: white;
      }

      .gpc-timeout-btn.continue:hover {
        background: #2563eb;
      }

      .gpc-timeout-btn.stop {
        background: #4b5563;
        color: #d1d5db;
      }

      .gpc-timeout-btn.stop:hover {
        background: #6b7280;
      }
```

**Step 2: Commit**

```bash
git add src/content.js
git commit -m "feat: add CSS for progress status and timeout prompt"
```

---

### Task 3: Add Date Formatting Helper

**Files:**
- Modify: `src/content.js` (after `parseISODateString` function, around line 507)

**Step 1: Add helper function to format date as "Mon YYYY"**

```javascript
  // Format date as "Mon YYYY" for display (e.g., "Feb 2024")
  function formatDateForDisplay(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return 'Unknown';
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  }
```

**Step 2: Commit**

```bash
git add src/content.js
git commit -m "feat: add date formatting helper for progress display"
```

---

### Task 4: Update Progress View HTML

**Files:**
- Modify: `src/content.js` (inside `getModalHTML()` function, around line 833-838)

**Step 1: Update progress view to include status text and timeout view**

Find:
```javascript
      <div class="gpc-modal-body gpc-progress" id="gpc-progress-view" style="display: none;">
        <div class="gpc-spinner"></div>
        <p class="gpc-progress-label">Selecting...</p>
        <p class="gpc-progress-count" id="gpc-progress-count">0</p>
        <button class="gpc-action-btn stop" data-action="stop">Stop Selection</button>
      </div>
```

Replace with:
```javascript
      <div class="gpc-modal-body gpc-progress" id="gpc-progress-view" style="display: none;">
        <div class="gpc-spinner"></div>
        <p class="gpc-progress-label" id="gpc-progress-label">Scanning...</p>
        <p class="gpc-progress-count" id="gpc-progress-count">0</p>
        <p class="gpc-progress-status" id="gpc-progress-status"></p>
        <button class="gpc-action-btn stop" data-action="stop">Stop</button>
      </div>
      <div class="gpc-modal-body gpc-timeout-view" id="gpc-timeout-view" style="display: none;">
        <p class="gpc-timeout-title">Scanning taking a while...</p>
        <p class="gpc-timeout-info" id="gpc-timeout-date">Currently viewing: Unknown</p>
        <p class="gpc-timeout-info" id="gpc-timeout-count">Photos selected: 0</p>
        <div class="gpc-timeout-buttons">
          <button class="gpc-timeout-btn continue" data-action="continue">Continue Scanning</button>
          <button class="gpc-timeout-btn stop" data-action="timeout-stop">Stop</button>
        </div>
      </div>
```

**Step 2: Commit**

```bash
git add src/content.js
git commit -m "feat: add progress status and timeout view HTML"
```

---

### Task 5: Add Progress Update Functions

**Files:**
- Modify: `src/content.js` (after `updateProgressCount` function, around line 1083)

**Step 1: Add functions to update progress label and status**

```javascript
  function updateProgressLabel(text) {
    if (!state.modal) return;
    const label = state.modal.querySelector('#gpc-progress-label');
    if (label) {
      label.textContent = text;
    }
  }

  function updateProgressStatus(text) {
    if (!state.modal) return;
    const status = state.modal.querySelector('#gpc-progress-status');
    if (status) {
      status.textContent = text;
    }
  }

  function showTimeoutPrompt() {
    if (!state.modal) return;

    const progressView = state.modal.querySelector('#gpc-progress-view');
    const timeoutView = state.modal.querySelector('#gpc-timeout-view');

    if (progressView) progressView.style.display = 'none';
    if (timeoutView) {
      timeoutView.style.display = 'block';

      // Update timeout view with current state
      const dateEl = timeoutView.querySelector('#gpc-timeout-date');
      const countEl = timeoutView.querySelector('#gpc-timeout-count');

      if (dateEl) {
        dateEl.textContent = `Currently viewing: ${formatDateForDisplay(selection.currentDateViewing)}`;
      }
      if (countEl) {
        countEl.textContent = `Photos selected: ${selection.count}`;
      }
    }

    selection.isPaused = true;
  }

  function hideTimeoutPrompt() {
    if (!state.modal) return;

    const progressView = state.modal.querySelector('#gpc-progress-view');
    const timeoutView = state.modal.querySelector('#gpc-timeout-view');

    if (timeoutView) timeoutView.style.display = 'none';
    if (progressView) progressView.style.display = 'block';

    selection.isPaused = false;
    selection.startTime = Date.now(); // Reset timer
  }
```

**Step 2: Commit**

```bash
git add src/content.js
git commit -m "feat: add progress update and timeout prompt functions"
```

---

### Task 6: Add Timeout Event Handlers

**Files:**
- Modify: `src/content.js` (inside `bindModalEvents` function, after the stop button handler, around line 879)

**Step 1: Add event handlers for timeout buttons**

Add after the existing stop button handler:

```javascript
    // Timeout continue button
    const continueBtn = modal.querySelector('[data-action="continue"]');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        hideTimeoutPrompt();
      });
    }

    // Timeout stop button
    const timeoutStopBtn = modal.querySelector('[data-action="timeout-stop"]');
    if (timeoutStopBtn) {
      timeoutStopBtn.addEventListener('click', () => {
        selection.shouldStop = true;
        selection.isPaused = false;
        hideTimeoutPrompt();
      });
    }
```

**Step 2: Commit**

```bash
git add src/content.js
git commit -m "feat: add timeout prompt event handlers"
```

---

### Task 7: Add Photo Date Check Helper

**Files:**
- Modify: `src/content.js` (after `matchesFilters` function, around line 565)

**Step 1: Add function to check if photo is before the target range**

```javascript
  // Check if a photo's date is before the "from" date (scrolled past target range)
  function isBeforeTargetRange(container) {
    if (!filters.dateRange.from) return false; // No from date, can't determine

    const metadata = getPhotoMetadata(container);
    if (!metadata || !metadata.date) return false;

    const fromDate = parseISODateString(filters.dateRange.from);
    return compareDatesOnly(metadata.date, fromDate) < 0;
  }

  // Check if a photo's date is within the target range
  function isWithinTargetRange(container) {
    const metadata = getPhotoMetadata(container);
    if (!metadata || !metadata.date) return false;

    const photoDate = metadata.date;

    if (filters.dateRange.from) {
      const fromDate = parseISODateString(filters.dateRange.from);
      if (compareDatesOnly(photoDate, fromDate) < 0) return false;
    }

    if (filters.dateRange.to) {
      const toDate = parseISODateString(filters.dateRange.to);
      if (compareDatesOnly(photoDate, toDate) > 0) return false;
    }

    return true;
  }
```

**Step 2: Commit**

```bash
git add src/content.js
git commit -m "feat: add date range check helpers"
```

---

### Task 8: Update startSelection to Initialize New State

**Files:**
- Modify: `src/content.js` (inside `startSelection` function, around line 925-927)

**Step 1: Update state initialization**

Find:
```javascript
    // Switch to progress view
    selection.isRunning = true;
    selection.count = 0;
    selection.shouldStop = false;
```

Replace with:
```javascript
    // Switch to progress view
    selection.isRunning = true;
    selection.count = 0;
    selection.shouldStop = false;
    selection.phase = 'scanning';
    selection.currentDateViewing = null;
    selection.startTime = Date.now();
    selection.isPaused = false;
```

**Step 2: Update initial progress label**

Find (a few lines below):
```javascript
    updateProgressCount(0);
```

Replace with:
```javascript
    updateProgressCount(0);
    updateProgressLabel('Scanning...');
    updateProgressStatus('');
```

**Step 3: Commit**

```bash
git add src/content.js
git commit -m "feat: initialize new selection state fields"
```

---

### Task 9: Rewrite Selection Loop with Phase Tracking

**Files:**
- Modify: `src/content.js` (replace entire `runSelectionLoop` function, around line 997-1075)

**Step 1: Replace the entire runSelectionLoop function**

```javascript
  async function runSelectionLoop() {
    const processedElements = new Set();
    let noNewPhotosCount = 0;
    let errorCount = 0;
    const MAX_NO_NEW = 3;
    const MAX_ERRORS = 5;
    const CLICK_DELAY = 75;
    const SCROLL_DELAY = 400;
    const TIMEOUT_MS = 180000; // 3 minutes

    while (!selection.shouldStop) {
      // Check for timeout (3 minutes)
      if (Date.now() - selection.startTime > TIMEOUT_MS) {
        showTimeoutPrompt();
        // Wait for user decision
        while (selection.isPaused && !selection.shouldStop) {
          await wait(100);
        }
        if (selection.shouldStop) break;
      }

      try {
        const photos = findPhotoContainers();

        // Check if we can find any photos
        if (photos.length === 0 && processedElements.size === 0) {
          errorCount++;
          if (errorCount >= MAX_ERRORS) {
            showErrorToast('Unable to find photos. Google may have updated their UI.');
            break;
          }
          await wait(1000);
          continue;
        }

        errorCount = 0;
        let foundNew = false;
        let oldestDateInBatch = null;
        let passedTargetRange = false;

        for (const container of photos) {
          if (selection.shouldStop) break;

          // Generate unique key
          const checkbox = getCheckbox(container);
          const photoEl = container.querySelector('[data-latest-bg]');
          const key = checkbox?.getAttribute('aria-label') ||
                      photoEl?.getAttribute('data-latest-bg') ||
                      container.getBoundingClientRect().top + '-' + container.getBoundingClientRect().left;

          if (processedElements.has(key)) continue;
          processedElements.add(key);
          foundNew = true;

          // Track oldest date seen
          const metadata = getPhotoMetadata(container);
          if (metadata && metadata.date) {
            if (!oldestDateInBatch || compareDatesOnly(metadata.date, oldestDateInBatch) < 0) {
              oldestDateInBatch = metadata.date;
            }
          }

          // Check if we've scrolled past the target range
          if (isBeforeTargetRange(container)) {
            passedTargetRange = true;
            console.log('Google Photos Cleaner: Passed target date range, stopping');
            break;
          }

          // Check if photo is within target range (for phase tracking)
          if (isWithinTargetRange(container)) {
            if (selection.phase === 'scanning') {
              selection.phase = 'selecting';
              updateProgressLabel('Selecting...');
              updateProgressStatus('');
            }
          }

          // Try to select if it matches all filters
          if (!matchesFilters(container)) continue;
          if (isSelected(container)) continue;

          try {
            const selected = selectPhoto(container);
            if (selected) {
              selection.count++;
              updateProgressCount(selection.count);
            }
          } catch (e) {
            console.warn('Failed to select photo:', e);
          }

          await wait(CLICK_DELAY);
        }

        // Update current viewing date for UI
        if (oldestDateInBatch) {
          selection.currentDateViewing = oldestDateInBatch;
          if (selection.phase === 'scanning') {
            updateProgressStatus(`Viewing: ${formatDateForDisplay(oldestDateInBatch)}`);
          }
        }

        // Stop if we've passed the target range
        if (passedTargetRange) {
          break;
        }

        // Only use noNewPhotos stop condition if no "from" date is set
        if (!foundNew) {
          noNewPhotosCount++;
          // If we have a "from" date, keep scrolling unless at bottom
          if (!filters.dateRange.from) {
            if (noNewPhotosCount >= MAX_NO_NEW || isAtBottom()) {
              break;
            }
          } else if (isAtBottom()) {
            // With "from" date, only stop at actual bottom
            break;
          }
        } else {
          noNewPhotosCount = 0;
        }

        scrollDown();
        await wait(SCROLL_DELAY);

      } catch (error) {
        console.error('Selection loop error:', error);
        errorCount++;
        if (errorCount >= MAX_ERRORS) {
          showErrorToast('Selection failed. Please try again.');
          break;
        }
        await wait(1000);
      }
    }

    selection.phase = 'complete';
  }
```

**Step 2: Commit**

```bash
git add src/content.js
git commit -m "feat: rewrite selection loop with infinite scroll support"
```

---

### Task 10: Update Completion State for Scanning Phase

**Files:**
- Modify: `src/content.js` (inside `showCompletionState` function, around line 970-976)

**Step 1: Update label text handling for different completion scenarios**

Find:
```javascript
    // Update label
    if (label) {
      if (count === 0) {
        label.textContent = 'No photos matched your filters';
        label.style.color = '#f59e0b';
      } else {
        label.textContent = 'Selection complete!';
        label.style.color = '#22c55e';
      }
    }
```

Replace with:
```javascript
    // Update label
    if (label) {
      if (selection.shouldStop && count === 0) {
        label.textContent = 'Selection stopped';
        label.style.color = '#9ca3af';
      } else if (count === 0) {
        label.textContent = 'No photos matched your filters';
        label.style.color = '#f59e0b';
      } else {
        label.textContent = 'Selection complete!';
        label.style.color = '#22c55e';
      }
    }

    // Clear status text
    const status = progressView.querySelector('#gpc-progress-status');
    if (status) {
      status.textContent = '';
    }
```

**Step 2: Commit**

```bash
git add src/content.js
git commit -m "feat: update completion state for different scenarios"
```

---

### Task 11: Reset State on Modal Open

**Files:**
- Modify: `src/content.js` (inside `openModal` function, around line 717-719)

**Step 1: Ensure new state fields are reset**

Find:
```javascript
    // Reset selection state for fresh start
    selection.isRunning = false;
    selection.count = 0;
    selection.shouldStop = false;
```

Replace with:
```javascript
    // Reset selection state for fresh start
    selection.isRunning = false;
    selection.count = 0;
    selection.shouldStop = false;
    selection.phase = 'idle';
    selection.currentDateViewing = null;
    selection.startTime = null;
    selection.isPaused = false;
```

**Step 2: Commit**

```bash
git add src/content.js
git commit -m "feat: reset all selection state fields on modal open"
```

---

### Task 12: Manual Testing

**Step 1: Load extension in Chrome**

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" or "Reload" if already loaded
4. Select `/Users/sohimo022/projects-2026/google-photos-cleaner/src/`

**Step 2: Test scanning phase**

1. Go to `https://photos.google.com`
2. Click "Cleaner" button
3. Set date range to 1 year ago (e.g., Feb 2025 to Feb 2025)
4. Click "Start Selection"
5. Verify: Shows "Scanning..." with current date being viewed
6. Verify: Scrolls automatically through photos

**Step 3: Test selecting phase**

1. Once target date range is reached, verify:
   - Label changes to "Selecting..."
   - Count increments as photos are selected
   - Photos get selected (checkboxes checked)

**Step 4: Test stop condition**

1. Set a date range in the past
2. Verify: Selection stops when scrolled past the "from" date
3. Verify: Shows completion state

**Step 5: Test timeout (optional - takes 3 minutes)**

1. Set date range to many years ago
2. Wait 3 minutes
3. Verify: Timeout prompt appears
4. Test "Continue Scanning" button
5. Test "Stop" button

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete infinite scroll support implementation"
git push
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Update selection state object |
| 2 | Add CSS styles for progress states |
| 3 | Add date formatting helper |
| 4 | Update progress view HTML |
| 5 | Add progress update functions |
| 6 | Add timeout event handlers |
| 7 | Add photo date check helpers |
| 8 | Update startSelection initialization |
| 9 | Rewrite selection loop |
| 10 | Update completion state handling |
| 11 | Reset state on modal open |
| 12 | Manual testing |
