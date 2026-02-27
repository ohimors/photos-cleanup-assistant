// src/content.js
// Content script for photos.google.com

(function() {
  'use strict';

  // Prevent multiple injections
  if (document.getElementById('gpc-shadow-host')) {
    return;
  }

  // Create Shadow DOM host
  const shadowHost = document.createElement('div');
  shadowHost.id = 'gpc-shadow-host';
  shadowHost.style.cssText = 'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 999999;';
  document.body.appendChild(shadowHost);

  // Attach shadow root
  const shadowRoot = shadowHost.attachShadow({ mode: 'closed' });

  // Inject styles
  const style = document.createElement('style');
  style.textContent = getStyles();
  shadowRoot.appendChild(style);

  // Create container for UI elements
  const container = document.createElement('div');
  container.id = 'gpc-container';
  shadowRoot.appendChild(container);

  console.log('Google Photos Cleaner: Shadow DOM initialized');

  // Store references
  const state = {
    shadowRoot,
    container,
    triggerButton: null,
    modal: null,
    isModalOpen: false
  };

  // Filter state
  const filters = {
    fileType: {
      photos: true,
      videos: true,
      raw: false
    },
    dateRange: {
      from: null,
      to: null
    },
    orientation: 'any'
  };

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

  function getStyles() {
    return `
      * {
        box-sizing: border-box;
      }

      #gpc-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
      }

      /* Modal backdrop */
      .gpc-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
      }

      /* Modal container */
      .gpc-modal {
        background: #1f2937;
        border-radius: 12px;
        width: 400px;
        max-width: 90vw;
        max-height: 90vh;
        overflow-y: auto;
        color: #f3f4f6;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      }

      /* Modal header */
      .gpc-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 20px 20px 0 20px;
      }

      .gpc-modal-title {
        font-size: 20px;
        font-weight: 600;
        margin: 0 0 4px 0;
        color: #f9fafb;
      }

      .gpc-modal-subtitle {
        font-size: 13px;
        color: #9ca3af;
        margin: 0;
      }

      .gpc-close-btn {
        background: none;
        border: none;
        color: #9ca3af;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
        transition: color 0.2s;
      }

      .gpc-close-btn:hover {
        color: #f3f4f6;
      }

      /* Modal body */
      .gpc-modal-body {
        padding: 20px;
      }

      /* Section */
      .gpc-section {
        background: #374151;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
      }

      .gpc-section:last-child {
        margin-bottom: 0;
      }

      .gpc-section-title {
        font-size: 12px;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin: 0 0 12px 0;
      }

      .gpc-section-hint {
        font-size: 12px;
        color: #6b7280;
        margin: 0 0 12px 0;
        float: right;
        margin-top: -24px;
      }

      /* Toggle buttons */
      .gpc-toggles {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .gpc-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #4b5563;
        border: 2px solid transparent;
        border-radius: 8px;
        padding: 10px 16px;
        color: #d1d5db;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 14px;
      }

      .gpc-toggle:hover {
        background: #6b7280;
      }

      .gpc-toggle.active {
        background: #3b82f6;
        border-color: #3b82f6;
        color: white;
      }

      .gpc-toggle-check {
        width: 18px;
        height: 18px;
        border: 2px solid currentColor;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .gpc-toggle.active .gpc-toggle-check {
        background: white;
        border-color: white;
      }

      .gpc-toggle.active .gpc-toggle-check::after {
        content: '\\2713';
        color: #3b82f6;
        font-size: 12px;
        font-weight: bold;
      }

      /* Date inputs */
      .gpc-date-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }

      .gpc-date-row:last-child {
        margin-bottom: 0;
      }

      .gpc-date-label {
        width: 40px;
        color: #9ca3af;
        font-size: 14px;
      }

      .gpc-date-input {
        flex: 1;
        background: #4b5563;
        border: 1px solid #6b7280;
        border-radius: 6px;
        padding: 10px 12px;
        color: #f3f4f6;
        font-size: 14px;
        font-family: inherit;
      }

      .gpc-date-input:focus {
        outline: none;
        border-color: #3b82f6;
      }

      /* Dropdown */
      .gpc-select {
        width: 100%;
        background: #4b5563;
        border: 1px solid #6b7280;
        border-radius: 6px;
        padding: 10px 12px;
        color: #f3f4f6;
        font-size: 14px;
        font-family: inherit;
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
      }

      .gpc-select:focus {
        outline: none;
        border-color: #3b82f6;
      }

      /* Action button */
      .gpc-action-btn {
        width: 100%;
        background: #22c55e;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 14px 20px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
        margin-top: 20px;
      }

      .gpc-action-btn:hover:not(:disabled) {
        background: #16a34a;
      }

      .gpc-action-btn:disabled {
        background: #4b5563;
        color: #9ca3af;
        cursor: not-allowed;
      }

      .gpc-action-btn.stop {
        background: #ef4444;
      }

      .gpc-action-btn.stop:hover {
        background: #dc2626;
      }

      /* Progress state */
      .gpc-progress {
        text-align: center;
        padding: 40px 20px;
      }

      .gpc-spinner {
        width: 48px;
        height: 48px;
        border: 4px solid #374151;
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: gpc-spin 1s linear infinite;
        margin: 0 auto 16px;
      }

      @keyframes gpc-spin {
        to { transform: rotate(360deg); }
      }

      .gpc-progress-label {
        color: #9ca3af;
        font-size: 14px;
        margin: 0 0 8px 0;
      }

      .gpc-progress-count {
        font-size: 36px;
        font-weight: 700;
        color: #3b82f6;
        margin: 0;
      }

      /* Toast */
      .gpc-toast {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: #1f2937;
        color: #f3f4f6;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        z-index: 9999999;
        animation: gpc-toast-in 0.3s ease;
      }

      .gpc-toast.hiding {
        animation: gpc-toast-out 0.3s ease forwards;
      }

      @keyframes gpc-toast-in {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }

      @keyframes gpc-toast-out {
        from {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        to {
          opacity: 0;
          transform: translateX(-50%) translateY(20px);
        }
      }

      .gpc-toast-icon {
        color: #22c55e;
        font-size: 18px;
      }

      /* Validation hint */
      .gpc-validation-hint {
        color: #f59e0b;
        font-size: 12px;
        text-align: center;
        margin-top: 8px;
      }

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
    `;
  }

  // DOM Selectors - may need updating if Google changes their UI
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

  // Parse the checkbox aria-label to extract metadata
  // Format: "Photo - Portrait - Feb 25, 2026, 8:46:07 AM"
  // Format: "Video - Landscape - Feb 23, 2026, 11:44:02 PM"
  function parseCheckboxLabel(ariaLabel) {
    if (!ariaLabel) return null;

    const result = {
      type: 'photo',      // 'photo' | 'video'
      orientation: 'unknown', // 'portrait' | 'landscape' | 'square' | 'unknown'
      date: null          // Date object
    };

    // Extract type (Photo or Video)
    if (ariaLabel.toLowerCase().startsWith('video')) {
      result.type = 'video';
    } else if (ariaLabel.toLowerCase().startsWith('photo')) {
      result.type = 'photo';
    }

    // Extract orientation
    const lowerLabel = ariaLabel.toLowerCase();
    if (lowerLabel.includes('portrait')) {
      result.orientation = 'portrait';
    } else if (lowerLabel.includes('landscape')) {
      result.orientation = 'landscape';
    } else if (lowerLabel.includes('square')) {
      result.orientation = 'square';
    }

    // Extract date - format is "Feb 25, 2026, 8:46:07 AM" at the end
    // Try multiple patterns to handle different formats
    const datePatterns = [
      /(\w{3}\s+\d{1,2},\s+\d{4})/,           // "Feb 25, 2026"
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/,           // "2/25/2026" or "02/25/26"
      /(\d{4}-\d{2}-\d{2})/,                   // "2026-02-25"
      /(\w+\s+\d{1,2},?\s+\d{4})/,             // "February 25 2026" or "February 25, 2026"
    ];

    for (const pattern of datePatterns) {
      const dateMatch = ariaLabel.match(pattern);
      if (dateMatch) {
        const parsed = Date.parse(dateMatch[1]);
        if (!isNaN(parsed)) {
          result.date = new Date(parsed);
          break;
        }
      }
    }

    // Log if we couldn't extract date from a non-empty aria-label
    if (!result.date && ariaLabel.length > 0) {
      console.log('Google Photos Cleaner: Could not parse date from aria-label:', ariaLabel);
    }

    return result;
  }

  // Find all visible photo containers with their checkboxes
  function findPhotoContainers() {
    const containers = document.querySelectorAll(SELECTORS.photoContainer);
    return Array.from(containers).filter(container => {
      // Must have a checkbox
      const checkbox = container.querySelector(SELECTORS.photoCheckbox);
      if (!checkbox) return false;

      // Must be visible
      const rect = container.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }

  // Get checkbox from a photo container
  // Only returns individual photo checkboxes, not date group selectors
  function getCheckbox(container) {
    const checkbox = container.querySelector(SELECTORS.photoCheckbox);
    if (!checkbox) return null;

    // Filter out date group selectors by checking aria-label
    // Individual photo checkboxes start with "Photo" or "Video"
    // Date group selectors have "Select" or "Select all photos from..."
    const ariaLabel = checkbox.getAttribute('aria-label');
    if (!ariaLabel) return null;

    const lowerLabel = ariaLabel.toLowerCase();

    // Must start with "photo" or "video" to be an individual photo checkbox
    if (lowerLabel.startsWith('photo') || lowerLabel.startsWith('video')) {
      return checkbox;
    }

    // Log unexpected aria-label patterns for debugging
    if (ariaLabel !== 'Select' && !ariaLabel.startsWith('Select all')) {
      console.log('Google Photos Cleaner: Unexpected checkbox aria-label:', ariaLabel);
    }

    return null;
  }

  // Get photo metadata from checkbox aria-label
  function getPhotoMetadata(container) {
    const checkbox = getCheckbox(container);
    if (!checkbox) return null;

    const ariaLabel = checkbox.getAttribute('aria-label');
    return parseCheckboxLabel(ariaLabel);
  }

  // Legacy function for compatibility - find photo elements
  function findPhotoElements() {
    // Return photo containers instead
    return findPhotoContainers();
  }

  // Check if visible photo containers have their metadata loaded (aria-labels present)
  function countContainersWithMetadata() {
    const containers = document.querySelectorAll(SELECTORS.photoContainer);
    let withMetadata = 0;
    let visible = 0;

    for (const container of containers) {
      const rect = container.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 &&
                        rect.top < window.innerHeight && rect.bottom > 0;
      if (!isVisible) continue;

      visible++;
      const checkbox = container.querySelector(SELECTORS.photoCheckbox);
      if (checkbox && checkbox.getAttribute('aria-label')) {
        withMetadata++;
      }
    }

    return { visible, withMetadata };
  }

  // Wait for photo metadata to load after scrolling
  // Returns when most visible photos have their aria-labels, or after timeout
  async function waitForMetadataLoaded(minRatio = 0.8, maxWaitMs = 2000, pollIntervalMs = 100) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const { visible, withMetadata } = countContainersWithMetadata();

      // If we have enough photos with metadata, we're good
      if (visible > 0 && withMetadata / visible >= minRatio) {
        console.log(`Google Photos Cleaner: Metadata loaded (${withMetadata}/${visible} photos ready)`);
        return true;
      }

      // If no visible containers at all, wait a bit for DOM to update
      if (visible === 0) {
        await wait(pollIntervalMs);
        continue;
      }

      console.log(`Google Photos Cleaner: Waiting for metadata (${withMetadata}/${visible} ready)...`);
      await wait(pollIntervalMs);
    }

    // Timeout reached, proceed anyway
    const { visible, withMetadata } = countContainersWithMetadata();
    console.log(`Google Photos Cleaner: Metadata wait timeout (${withMetadata}/${visible} ready), proceeding`);
    return false;
  }

  // Compare two dates by year, month, day only (ignoring time/timezone)
  function compareDatesOnly(date1, date2) {
    const y1 = date1.getFullYear(), m1 = date1.getMonth(), d1 = date1.getDate();
    const y2 = date2.getFullYear(), m2 = date2.getMonth(), d2 = date2.getDate();
    if (y1 !== y2) return y1 - y2;
    if (m1 !== m2) return m1 - m2;
    return d1 - d2;
  }

  // Parse ISO date string (YYYY-MM-DD) to local date, avoiding timezone issues
  function parseISODateString(dateString) {
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
    return new Date(dateString);
  }

  // Format date as "Mon YYYY" for display (e.g., "Feb 2024")
  function formatDateForDisplay(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return 'Unknown';
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  // Check if photo container matches current filters
  function matchesFilters(container) {
    // Get metadata from checkbox aria-label
    const metadata = getPhotoMetadata(container);

    if (!metadata) {
      console.log('Google Photos Cleaner: Could not get metadata for container, skipping');
      return false;
    }

    // Check file type
    const isPhoto = metadata.type === 'photo';
    const isVid = metadata.type === 'video';

    if (isPhoto && !filters.fileType.photos) return false;
    if (isVid && !filters.fileType.videos) return false;
    // Note: RAW detection not available from aria-label, assume photos include RAW for now

    // Check date range
    if (filters.dateRange.from || filters.dateRange.to) {
      const photoDate = metadata.date;

      // If we can't determine the date and a date filter is set, skip this photo
      if (!photoDate) {
        console.log('Google Photos Cleaner: Could not determine date for photo, skipping');
        return false;
      }

      console.log('Google Photos Cleaner: Photo date:', photoDate.toDateString(),
        'Filter from:', filters.dateRange.from, 'to:', filters.dateRange.to);

      if (filters.dateRange.from) {
        const fromDate = parseISODateString(filters.dateRange.from);
        if (compareDatesOnly(photoDate, fromDate) < 0) {
          console.log('Google Photos Cleaner: Photo before date range, skipping');
          return false;
        }
      }
      if (filters.dateRange.to) {
        const toDate = parseISODateString(filters.dateRange.to);
        if (compareDatesOnly(photoDate, toDate) > 0) {
          console.log('Google Photos Cleaner: Photo after date range, skipping');
          return false;
        }
      }
    }

    // Check orientation (photos only)
    if (filters.orientation !== 'any' && isPhoto) {
      const orientation = metadata.orientation;
      if (orientation !== 'unknown' && orientation !== filters.orientation) {
        return false;
      }
    }

    return true;
  }

  // Check if a photo's date is before the "from" date (scrolled past target range)
  function isBeforeTargetRange(container) {
    if (!filters.dateRange.from) return false; // No from date, can't determine

    const metadata = getPhotoMetadata(container);
    if (!metadata || !metadata.date) return false;

    const fromDate = parseISODateString(filters.dateRange.from);
    return compareDatesOnly(metadata.date, fromDate) < 0;
  }

  // Check if a photo's date is after the "to" date (need to scroll up more to reach range)
  function isAfterTargetRange(container) {
    if (!filters.dateRange.to) return false; // No to date, can't determine

    const metadata = getPhotoMetadata(container);
    if (!metadata || !metadata.date) return false;

    const toDate = parseISODateString(filters.dateRange.to);
    return compareDatesOnly(metadata.date, toDate) > 0;
  }

  // Get the oldest (earliest) date visible on screen
  function getOldestVisibleDate() {
    const containers = findPhotoContainers();
    let oldestDate = null;

    for (const container of containers) {
      const metadata = getPhotoMetadata(container);
      if (metadata && metadata.date) {
        if (!oldestDate || compareDatesOnly(metadata.date, oldestDate) < 0) {
          oldestDate = metadata.date;
        }
      }
    }

    return oldestDate;
  }

  // Get the newest (most recent) date visible on screen
  function getNewestVisibleDate() {
    const containers = findPhotoContainers();
    let newestDate = null;

    for (const container of containers) {
      const metadata = getPhotoMetadata(container);
      if (metadata && metadata.date) {
        if (!newestDate || compareDatesOnly(metadata.date, newestDate) > 0) {
          newestDate = metadata.date;
        }
      }
    }

    return newestDate;
  }

  // Scroll to bottom of the photo library
  async function scrollToBottom() {
    const container = getScrollContainer();
    let lastScrollHeight = 0;
    let stuckCount = 0;

    while (stuckCount < 3) {
      if (container === document.documentElement || container === document.body) {
        window.scrollTo({ top: container.scrollHeight, behavior: 'instant' });
      } else {
        container.scrollTop = container.scrollHeight;
      }

      await wait(300);
      await waitForMetadataLoaded(0.5, 1000, 100);

      const currentScrollHeight = container.scrollHeight;
      if (currentScrollHeight === lastScrollHeight) {
        stuckCount++;
      } else {
        stuckCount = 0;
        lastScrollHeight = currentScrollHeight;
      }
    }

    console.log('Google Photos Cleaner: Reached bottom, scroll height:', container.scrollHeight);
  }

  // Jump to a specific scroll position (0 to 1 = top to bottom)
  function jumpToScrollPercent(percent) {
    const container = getScrollContainer();
    const maxScroll = container.scrollHeight - container.clientHeight;
    const targetScroll = Math.floor(maxScroll * percent);

    if (container === document.documentElement || container === document.body) {
      window.scrollTo({ top: targetScroll, behavior: 'instant' });
    } else {
      container.scrollTop = targetScroll;
    }

    console.log(`Google Photos Cleaner: Jumped to ${(percent * 100).toFixed(1)}% (scroll: ${targetScroll})`);
  }

  // Get current scroll position as a percentage (0 to 1)
  function getScrollPercent() {
    const container = getScrollContainer();
    const maxScroll = container.scrollHeight - container.clientHeight;
    if (maxScroll <= 0) return 0;

    const currentScroll = container === document.documentElement || container === document.body
      ? window.scrollY
      : container.scrollTop;

    return currentScroll / maxScroll;
  }

  // Binary search to find the scroll position for a target date
  // Returns true if found a good position, false if target date not in library
  async function binarySearchToDate(targetDate, statusCallback) {
    console.log(`Google Photos Cleaner: Binary search for date ${targetDate.toDateString()}`);

    const container = getScrollContainer();

    // Step 1: Check top (newest photos)
    scrollToTop();
    await wait(500);
    await waitForMetadataLoaded(0.8, 2000, 100);

    const topDate = getNewestVisibleDate();
    if (!topDate) {
      console.log('Google Photos Cleaner: No photos found at top');
      return false;
    }

    console.log(`Google Photos Cleaner: Top date: ${topDate.toDateString()}`);

    // If target is newer than newest photo, start from top
    if (compareDatesOnly(targetDate, topDate) >= 0) {
      console.log('Google Photos Cleaner: Target date is at or after newest, starting from top');
      return true;
    }

    // Step 2: Scroll to bottom to establish bounds
    if (statusCallback) statusCallback('Finding library bounds...');
    await scrollToBottom();

    const bottomDate = getOldestVisibleDate();
    if (!bottomDate) {
      console.log('Google Photos Cleaner: No photos found at bottom');
      scrollToTop();
      return false;
    }

    console.log(`Google Photos Cleaner: Bottom date: ${bottomDate.toDateString()}`);

    // If target is older than oldest photo, start from bottom
    if (compareDatesOnly(targetDate, bottomDate) <= 0) {
      console.log('Google Photos Cleaner: Target date is at or before oldest, starting from bottom');
      return true;
    }

    // Step 3: Binary search
    let low = 0;    // Top (newest)
    let high = 1;   // Bottom (oldest)
    let iterations = 0;
    const maxIterations = 20;

    while (iterations < maxIterations && (high - low) > 0.01) {
      iterations++;
      const mid = (low + high) / 2;

      if (statusCallback) statusCallback(`Searching... (step ${iterations})`);

      jumpToScrollPercent(mid);
      await wait(300);
      await waitForMetadataLoaded(0.8, 2000, 100);

      const oldestVisible = getOldestVisibleDate();
      const newestVisible = getNewestVisibleDate();

      if (!oldestVisible || !newestVisible) {
        console.log(`Google Photos Cleaner: No dates at ${(mid * 100).toFixed(1)}%, trying again`);
        await wait(500);
        continue;
      }

      console.log(`Google Photos Cleaner: At ${(mid * 100).toFixed(1)}%: ${newestVisible.toDateString()} to ${oldestVisible.toDateString()}`);

      // Check if target is in current view
      if (compareDatesOnly(targetDate, oldestVisible) >= 0 &&
          compareDatesOnly(targetDate, newestVisible) <= 0) {
        console.log('Google Photos Cleaner: Target date is in current view!');
        break;
      }

      // Adjust search range
      if (compareDatesOnly(targetDate, oldestVisible) < 0) {
        // Target is older, need to scroll down
        low = mid;
      } else {
        // Target is newer, need to scroll up
        high = mid;
      }
    }

    // Step 4: Fine-tune - scroll up until we see dates >= target
    if (statusCallback) statusCallback('Fine-tuning position...');

    let finetuneAttempts = 0;
    while (finetuneAttempts < 10) {
      const newestVisible = getNewestVisibleDate();
      if (!newestVisible) break;

      // If newest visible is at or after target, we're in the right spot
      if (compareDatesOnly(newestVisible, targetDate) >= 0) {
        console.log('Google Photos Cleaner: Found good starting position');
        break;
      }

      // Scroll up a bit
      scrollUp();
      await wait(300);
      await waitForMetadataLoaded(0.8, 1000, 100);
      finetuneAttempts++;
    }

    console.log(`Google Photos Cleaner: Binary search complete after ${iterations} iterations`);
    return true;
  }

  // Scroll UP until we reach the TO date (since jumping to a year lands at January)
  // Returns true if we found the TO date area, false if we hit the top without finding it
  async function scrollUpToToDate() {
    if (!filters.dateRange.to) return true; // No TO date, nothing to do

    const toDate = parseISODateString(filters.dateRange.to);
    const maxScrollAttempts = 50; // Safety limit
    let attempts = 0;

    console.log(`Google Photos Cleaner: Scrolling up to reach TO date: ${filters.dateRange.to}`);
    updateProgressStatus(`Scrolling to ${formatDateForDisplay(toDate)}...`);

    while (attempts < maxScrollAttempts) {
      attempts++;

      await waitForMetadataLoaded(0.8, 2000, 100);

      // Check if any visible photo is at or after the TO date
      const photos = findPhotoContainers();
      let foundToDateOrLater = false;
      let oldestDateSeen = null;

      for (const container of photos) {
        const metadata = getPhotoMetadata(container);
        if (metadata && metadata.date) {
          if (!oldestDateSeen || compareDatesOnly(metadata.date, oldestDateSeen) < 0) {
            oldestDateSeen = metadata.date;
          }
          // If this photo is at or after the TO date, we've reached our starting point
          if (compareDatesOnly(metadata.date, toDate) >= 0) {
            foundToDateOrLater = true;
          }
        }
      }

      if (foundToDateOrLater) {
        console.log(`Google Photos Cleaner: Reached TO date area after ${attempts} scroll(s)`);
        return true;
      }

      // If we're at the top and haven't found it, the TO date might not exist in library
      if (isAtTop()) {
        console.log('Google Photos Cleaner: Reached top of library');
        return true; // Start from top anyway
      }

      // Log progress
      if (oldestDateSeen) {
        console.log(`Google Photos Cleaner: Currently at ${formatDateForDisplay(oldestDateSeen)}, scrolling up...`);
      }

      scrollUp();
      await wait(300); // Let scroll settle
    }

    console.log('Google Photos Cleaner: Max scroll attempts reached while seeking TO date');
    return false;
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

  // Check if photo container is already selected
  function isSelected(container) {
    const checkbox = getCheckbox(container);
    if (!checkbox) return false;

    return checkbox.getAttribute('aria-checked') === 'true';
  }

  // Select a photo by clicking its checkbox with retry logic
  async function selectPhoto(container, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Trigger mouseenter to ensure checkbox is visible and interactive
      // Google Photos only shows checkboxes on hover
      container.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      container.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

      // Wait for checkbox to become interactive (increased from 30ms)
      await wait(80);

      const checkbox = getCheckbox(container);

      if (!checkbox) {
        console.warn('Google Photos Cleaner: Could not find checkbox for photo container');
        if (attempt < maxRetries) {
          await wait(100);
          continue;
        }
        return false;
      }

      // Skip if already selected
      if (checkbox.getAttribute('aria-checked') === 'true') {
        return true;
      }

      // Click the checkbox
      checkbox.click();

      // Wait and verify selection took effect (increased from 50ms)
      await wait(100);

      // Check if selection succeeded
      if (checkbox.getAttribute('aria-checked') === 'true') {
        if (attempt > 1) {
          console.log('Google Photos Cleaner: Selected photo (attempt ' + attempt + ')');
        }
        return true;
      }

      // Selection didn't take, retry with longer wait
      console.log('Google Photos Cleaner: Selection attempt ' + attempt + ' failed, retrying...');
      await wait(100);
    }

    console.warn('Google Photos Cleaner: Failed to select photo after ' + maxRetries + ' attempts');
    return false;
  }

  // Scroll helpers
  // Google Photos uses a custom scrollable container, not window scroll
  function getScrollContainer() {
    // Try multiple selectors to find the scrollable container
    // Google Photos main content area - look for the element that actually scrolls
    const selectors = [
      '[role="main"]',                    // Main content area
      '.yDSiEe',                          // Google's common scroller class
      '[jsname="Zppfte"]',                // Photos grid container
      'div[data-routing-target]',         // Main routing container
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && (el.scrollHeight > el.clientHeight || el.scrollTop > 0)) {
        return el;
      }
    }

    // Fallback: find any element that is scrollable and contains photos
    const photoContainer = document.querySelector(SELECTORS.photoContainer);
    if (photoContainer) {
      let parent = photoContainer.parentElement;
      while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent);
        const isScrollable = style.overflowY === 'auto' || style.overflowY === 'scroll';
        const canScroll = parent.scrollHeight > parent.clientHeight;
        if (isScrollable && canScroll) {
          return parent;
        }
        parent = parent.parentElement;
      }
    }

    // Last resort: use document.documentElement or body
    return document.documentElement.scrollHeight > window.innerHeight
      ? document.documentElement
      : document.body;
  }

  function scrollToTop() {
    const container = getScrollContainer();
    if (container === document.documentElement || container === document.body) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      container.scrollTop = 0;
    }
  }

  function scrollDown() {
    const container = getScrollContainer();
    const scrollAmount = window.innerHeight * 0.8;

    if (container === document.documentElement || container === document.body) {
      window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    } else {
      container.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    }

    console.log('Google Photos Cleaner: Scrolling container:', container.className || container.tagName,
      'scrollTop:', container.scrollTop, 'scrollHeight:', container.scrollHeight);
  }

  function scrollUp() {
    const container = getScrollContainer();
    const scrollAmount = window.innerHeight * 0.8;

    if (container === document.documentElement || container === document.body) {
      window.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
    } else {
      container.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
    }

    console.log('Google Photos Cleaner: Scrolling UP, scrollTop:', container.scrollTop);
  }

  function isAtTop() {
    const container = getScrollContainer();

    if (container === document.documentElement || container === document.body) {
      return window.scrollY <= 100;
    }

    return container.scrollTop <= 100;
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isAtBottom() {
    const container = getScrollContainer();

    if (container === document.documentElement || container === document.body) {
      return (window.scrollY + window.innerHeight) >= (document.documentElement.scrollHeight - 100);
    }

    // For custom container
    return (container.scrollTop + container.clientHeight) >= (container.scrollHeight - 100);
  }

  function getScrollPosition() {
    const container = getScrollContainer();
    if (container === document.documentElement || container === document.body) {
      return { scrollTop: window.scrollY, scrollHeight: document.documentElement.scrollHeight };
    }
    return { scrollTop: container.scrollTop, scrollHeight: container.scrollHeight };
  }

  // Find the date scrubber element (timeline on right side)
  function findDateScrubber() {
    return document.querySelector(SELECTORS.dateScrubber);
  }

  // Make the date scrubber visible (it's hidden by default, only shows on hover/scroll)
  function showDateScrubber(scrubber) {
    if (!scrubber) return;
    scrubber.style.opacity = '1';
    scrubber.style.visibility = 'visible';
  }

  // Hide the date scrubber (restore default hidden state)
  function hideDateScrubber(scrubber) {
    if (!scrubber) return;
    scrubber.style.opacity = '';
    scrubber.style.visibility = '';
  }

  // Store removed scrubber info for restoration
  let removedScrubber = null;
  let scrubberParent = null;
  let scrubberNextSibling = null;

  // Remove scrubber from DOM during scanning
  function removeScrubberFromDOM(scrubber) {
    if (!scrubber) {
      console.log('Google Photos Cleaner: removeScrubberFromDOM - scrubber is null');
      return;
    }

    // Store references for restoration
    scrubberParent = scrubber.parentElement;
    scrubberNextSibling = scrubber.nextSibling;
    removedScrubber = scrubber;

    // Remove from DOM
    scrubber.remove();
    console.log('Google Photos Cleaner: Scrubber removed from DOM');
  }

  // Restore scrubber to DOM
  function restoreScrubberToDOM() {
    // Stop the scrubber hiding interval if running
    stopScrubberHider();

    if (!removedScrubber || !scrubberParent) {
      console.log('Google Photos Cleaner: No scrubber to restore');
      return;
    }

    // Re-insert at original position
    if (scrubberNextSibling) {
      scrubberParent.insertBefore(removedScrubber, scrubberNextSibling);
    } else {
      scrubberParent.appendChild(removedScrubber);
    }

    console.log('Google Photos Cleaner: Scrubber restored to DOM');

    // Clear references
    removedScrubber = null;
    scrubberParent = null;
    scrubberNextSibling = null;
  }

  // Interval ID for continuous scrubber hiding
  let scrubberHiderInterval = null;

  // Continuously remove scrubber during scanning (in case Google recreates it)
  function startScrubberHider() {
    if (scrubberHiderInterval) return;

    scrubberHiderInterval = setInterval(() => {
      const scrubber = findDateScrubber();
      if (scrubber && scrubber.parentElement) {
        scrubber.remove();
        console.log('Google Photos Cleaner: Scrubber removed by hider');
      }
    }, 50); // Check more frequently

    console.log('Google Photos Cleaner: Scrubber hider started');
  }

  // Stop the continuous scrubber hider
  function stopScrubberHider() {
    if (scrubberHiderInterval) {
      clearInterval(scrubberHiderInterval);
      scrubberHiderInterval = null;
      console.log('Google Photos Cleaner: Scrubber hider stopped');
    }
    // Note: scrubber will be naturally recreated by Google Photos when user interacts with page
  }

  // Disable pointer events on the scrubber to prevent mouse interference during scanning
  function disableScrubberInteraction(scrubber) {
    if (!scrubber) return;
    scrubber.style.pointerEvents = 'none';
  }

  // Re-enable pointer events on the scrubber
  function enableScrubberInteraction(scrubber) {
    if (!scrubber) return;
    scrubber.style.pointerEvents = '';
  }

  // Mouse event blocking to prevent timeline interference during scanning
  let mouseBlockerActive = false;

  // Handler that blocks mouse events on the right side of the screen (where timeline is)
  function mouseBlockerHandler(e) {
    // Block events in the rightmost 150px of the viewport (timeline area)
    if (e.clientX > window.innerWidth - 150) {
      e.stopPropagation();
      e.preventDefault();
    }
  }

  // Enable mouse event blocking using capture phase listeners
  function enableMouseBlocker() {
    if (mouseBlockerActive) return;

    // Capture phase (true) ensures we intercept before Google's handlers
    document.addEventListener('mousemove', mouseBlockerHandler, true);
    document.addEventListener('mouseenter', mouseBlockerHandler, true);
    document.addEventListener('mouseover', mouseBlockerHandler, true);
    document.addEventListener('pointerover', mouseBlockerHandler, true);
    document.addEventListener('pointermove', mouseBlockerHandler, true);

    mouseBlockerActive = true;
    console.log('Google Photos Cleaner: Mouse blocker enabled');
  }

  // Disable mouse event blocking
  function disableMouseBlocker() {
    if (!mouseBlockerActive) return;

    document.removeEventListener('mousemove', mouseBlockerHandler, true);
    document.removeEventListener('mouseenter', mouseBlockerHandler, true);
    document.removeEventListener('mouseover', mouseBlockerHandler, true);
    document.removeEventListener('pointerover', mouseBlockerHandler, true);
    document.removeEventListener('pointermove', mouseBlockerHandler, true);

    mouseBlockerActive = false;
    console.log('Google Photos Cleaner: Mouse blocker disabled');
  }

  // Find a year element in the date scrubber
  // Returns exact match if found, otherwise returns nearest year element
  function findYearInScrubber(scrubber, targetYear) {
    const yearElements = scrubber.querySelectorAll(SELECTORS.yearLabel);
    let nearestElement = null;
    let nearestDiff = Infinity;

    for (const element of yearElements) {
      const yearText = parseInt(element.textContent, 10);
      if (isNaN(yearText)) continue;

      // Exact match
      if (yearText === targetYear) {
        return element;
      }

      // Track nearest
      const diff = Math.abs(yearText - targetYear);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearestElement = element;
      }
    }

    return nearestElement;
  }

  // Jump to a specific year using the date scrubber
  async function jumpToYear(targetYear) {
    console.log(`Google Photos Cleaner: Attempting to jump to year ${targetYear}`);

    const scrubber = findDateScrubber();
    if (!scrubber) {
      console.log('Google Photos Cleaner: Date scrubber not found');
      return false;
    }

    // Make scrubber visible (it's hidden by default)
    showDateScrubber(scrubber);
    await wait(100); // Brief wait for visibility to take effect

    const yearElement = findYearInScrubber(scrubber, targetYear);
    if (!yearElement) {
      console.log('Google Photos Cleaner: No year element found in scrubber');
      return false;
    }

    const actualYear = parseInt(yearElement.textContent, 10);
    console.log(`Google Photos Cleaner: Jumping to year ${actualYear}${actualYear !== targetYear ? ` (nearest to ${targetYear})` : ''}`);

    // Get the year element's position
    const rect = yearElement.getBoundingClientRect();

    // Dispatch mousedown on the scrubber with coordinates pointing to the year
    // Google's jsaction framework uses mousedown (not click) and reads the Y coordinate
    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    });
    scrubber.dispatchEvent(event);

    await wait(1000); // Wait longer for page to settle after jump

    // Re-find scrubber after jump (DOM may have changed) and remove it from DOM
    const scrubberAfterJump = findDateScrubber();
    removeScrubberFromDOM(scrubberAfterJump);

    // Start continuous scrubber hider in case Google recreates it
    startScrubberHider();

    // Wait longer for metadata after a big jump (up to 5 seconds)
    await waitForMetadataLoaded(0.8, 5000, 200);

    console.log(`Google Photos Cleaner: Successfully jumped to year ${actualYear}`);
    return true;
  }

  // Inject trigger button into Google Photos sidebar navigation
  function injectTriggerButton() {
    // Check if button already exists
    if (document.getElementById('gpc-trigger-button')) {
      return;
    }

    // Google Photos uses a sidebar navigation with role="navigation"
    const sidebar = document.querySelector('[role="navigation"]') ||
                    document.querySelector('.RSjvib');

    if (!sidebar) {
      console.warn('Google Photos Cleaner: Could not find sidebar navigation');
      // Retry after delay
      setTimeout(injectTriggerButton, 1000);
      return;
    }

    // Find the top section of the sidebar (contains logo and account)
    const topSection = sidebar.querySelector('.poGHk') ||
                       sidebar.querySelector('.MrWjeb') ||
                       sidebar.firstElementChild;

    if (!topSection) {
      console.warn('Google Photos Cleaner: Could not find sidebar top section');
      setTimeout(injectTriggerButton, 1000);
      return;
    }

    // Create a container for our button that matches sidebar styling
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    `;

    // Create trigger button
    const button = document.createElement('button');
    button.id = 'gpc-trigger-button';
    button.textContent = 'Cleaner';
    button.title = 'Google Photos Cleaner - Select photos by filters';
    button.style.cssText = `
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      width: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    `;
    button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h18v2H3v-2z"/>
      </svg>
      Cleaner
    `;
    button.addEventListener('mouseenter', () => {
      button.style.background = '#2563eb';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '#3b82f6';
    });
    button.addEventListener('click', toggleModal);

    buttonContainer.appendChild(button);

    // Insert after the top section
    const parent = topSection.parentElement;
    if (!parent) {
      console.warn('Google Photos Cleaner: Could not find parent element');
      setTimeout(injectTriggerButton, 1000);
      return;
    }

    if (topSection.nextSibling) {
      parent.insertBefore(buttonContainer, topSection.nextSibling);
    } else {
      parent.appendChild(buttonContainer);
    }

    state.triggerButton = button;
    console.log('Google Photos Cleaner: Trigger button injected into sidebar');
  }

  // Toggle modal open/closed
  function toggleModal() {
    if (state.isModalOpen) {
      closeModal();
    } else {
      openModal();
    }
  }

  async function openModal() {
    if (state.modal) return;

    // Reset selection state for fresh start
    selection.isRunning = false;
    selection.count = 0;
    selection.shouldStop = false;
    selection.phase = 'idle';
    selection.currentDateViewing = null;
    selection.startTime = null;
    selection.isPaused = false;

    // Reset filters to defaults before loading preferences
    filters.fileType.photos = true;
    filters.fileType.videos = true;
    filters.fileType.raw = false;
    filters.dateRange.from = null;
    filters.dateRange.to = null;
    filters.orientation = 'any';

    // Load saved preferences (optional - comment out to always start fresh)
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_PREFERENCES' });
      if (response && response.lastUsedFilters) {
        Object.assign(filters.fileType, response.lastUsedFilters.fileType);
        Object.assign(filters.dateRange, response.lastUsedFilters.dateRange);
        filters.orientation = response.lastUsedFilters.orientation;
      }
    } catch (e) {
      console.warn('Could not load preferences:', e);
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'gpc-backdrop';
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    const modal = document.createElement('div');
    modal.className = 'gpc-modal';
    modal.innerHTML = getModalHTML();

    backdrop.appendChild(modal);
    state.container.appendChild(backdrop);
    state.modal = backdrop;
    state.isModalOpen = true;

    // Bind event listeners
    bindModalEvents(modal);
    updateActionButton();
  }

  function closeModal() {
    if (!state.modal) return;

    // If selection is running, stop it
    if (selection.isRunning) {
      selection.shouldStop = true;
    }

    state.modal.remove();
    state.modal = null;
    state.isModalOpen = false;
  }

  function getModalHTML() {
    return `
      <div class="gpc-modal-header">
        <div>
          <h2 class="gpc-modal-title">Google Photos Cleaner</h2>
          <p class="gpc-modal-subtitle">Quickly select photos and videos by type, date range, and orientation.</p>
        </div>
        <button class="gpc-close-btn" data-action="close">&times;</button>
      </div>
      <div class="gpc-modal-body" id="gpc-filter-view">
        <!-- File Type -->
        <div class="gpc-section">
          <p class="gpc-section-title">File type</p>
          <p class="gpc-section-hint">Choose what to include</p>
          <div class="gpc-toggles">
            <button class="gpc-toggle ${filters.fileType.photos ? 'active' : ''}" data-filter="photos">
              <span class="gpc-toggle-check"></span>
              Photos
            </button>
            <button class="gpc-toggle ${filters.fileType.videos ? 'active' : ''}" data-filter="videos">
              <span class="gpc-toggle-check"></span>
              Videos
            </button>
            <button class="gpc-toggle ${filters.fileType.raw ? 'active' : ''}" data-filter="raw">
              <span class="gpc-toggle-check"></span>
              RAW
            </button>
          </div>
        </div>

        <!-- Date Range -->
        <div class="gpc-section">
          <p class="gpc-section-title">Date range</p>
          <p class="gpc-section-hint">Limit selection to a specific time period</p>
          <div class="gpc-date-row">
            <label class="gpc-date-label">From</label>
            <input type="date" class="gpc-date-input" data-filter="date-from" value="${filters.dateRange.from || ''}">
          </div>
          <div class="gpc-date-row">
            <label class="gpc-date-label">To</label>
            <input type="date" class="gpc-date-input" data-filter="date-to" value="${filters.dateRange.to || ''}">
          </div>
        </div>

        <!-- Orientation -->
        <div class="gpc-section">
          <p class="gpc-section-title">Orientation</p>
          <p class="gpc-section-hint">Target landscape, portrait, or square photos</p>
          <select class="gpc-select" data-filter="orientation">
            <option value="any" ${filters.orientation === 'any' ? 'selected' : ''}>Any orientation</option>
            <option value="landscape" ${filters.orientation === 'landscape' ? 'selected' : ''}>Landscape</option>
            <option value="portrait" ${filters.orientation === 'portrait' ? 'selected' : ''}>Portrait</option>
            <option value="square" ${filters.orientation === 'square' ? 'selected' : ''}>Square</option>
          </select>
        </div>

        <button class="gpc-action-btn" data-action="start" disabled>Start Selection</button>
        <p class="gpc-validation-hint" id="gpc-validation-hint"></p>
      </div>
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
    `;
  }

  function bindModalEvents(modal) {
    // Close button
    modal.querySelector('[data-action="close"]').addEventListener('click', closeModal);

    // File type toggles
    modal.querySelectorAll('[data-filter="photos"], [data-filter="videos"], [data-filter="raw"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const filterKey = btn.dataset.filter;
        filters.fileType[filterKey] = !filters.fileType[filterKey];
        btn.classList.toggle('active', filters.fileType[filterKey]);
        updateActionButton();
      });
    });

    // Date inputs
    modal.querySelector('[data-filter="date-from"]').addEventListener('change', (e) => {
      filters.dateRange.from = e.target.value || null;
      updateActionButton();
    });

    modal.querySelector('[data-filter="date-to"]').addEventListener('change', (e) => {
      filters.dateRange.to = e.target.value || null;
      updateActionButton();
    });

    // Orientation select
    modal.querySelector('[data-filter="orientation"]').addEventListener('change', (e) => {
      filters.orientation = e.target.value;
      updateActionButton();
    });

    // Start button
    modal.querySelector('[data-action="start"]').addEventListener('click', startSelection);

    // Stop button
    modal.querySelector('[data-action="stop"]').addEventListener('click', () => {
      selection.shouldStop = true;
    });

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
  }

  function updateActionButton() {
    if (!state.modal) return;

    const btn = state.modal.querySelector('[data-action="start"]');
    const hint = state.modal.querySelector('#gpc-validation-hint');

    // Check if filters would select everything
    const noDateFilter = !filters.dateRange.from && !filters.dateRange.to;
    const noOrientationFilter = filters.orientation === 'any';

    // Require at least one meaningful filter
    const hasFilter = !noDateFilter || !noOrientationFilter || !filters.fileType.photos || !filters.fileType.videos || filters.fileType.raw;

    if (!hasFilter) {
      btn.disabled = true;
      hint.textContent = 'Set at least one filter to start selection';
    } else if (!filters.fileType.photos && !filters.fileType.videos && !filters.fileType.raw) {
      btn.disabled = true;
      hint.textContent = 'Select at least one file type';
    } else {
      btn.disabled = false;
      hint.textContent = '';
    }
  }

  async function startSelection() {
    if (selection.isRunning) return;

    // Save current filters for next time
    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_FILTERS',
        filters: {
          fileType: { ...filters.fileType },
          dateRange: { ...filters.dateRange },
          orientation: filters.orientation
        }
      });
    } catch (e) {
      console.warn('Could not save filters:', e);
    }

    // Start selection with UI
    await runSelectionWithUI();
  }

  // Run the selection process with UI updates
  async function runSelectionWithUI() {
    // Switch to progress view
    selection.isRunning = true;
    selection.count = 0;
    selection.shouldStop = false;
    selection.phase = 'scanning';
    selection.currentDateViewing = null;
    selection.startTime = Date.now();
    selection.isPaused = false;

    // Ensure modal is open and showing progress
    if (!state.modal) {
      await openModal();
    }

    const filterView = state.modal.querySelector('#gpc-filter-view');
    const progressView = state.modal.querySelector('#gpc-progress-view');
    filterView.style.display = 'none';
    progressView.style.display = 'block';

    updateProgressCount(0);
    updateProgressLabel('Preparing...');
    updateProgressStatus('');

    // If we have a "to" date, use binary search to jump to it
    if (filters.dateRange.to) {
      const toDate = parseISODateString(filters.dateRange.to);
      updateProgressLabel('Searching...');

      const found = await binarySearchToDate(toDate, (status) => {
        updateProgressStatus(status);
      });

      if (!found) {
        console.log('Google Photos Cleaner: Binary search failed, starting from top');
        scrollToTop();
        await wait(500);
      }

      // Check if user cancelled during search
      if (selection.shouldStop) {
        selection.isRunning = false;
        showCompletionState(0);
        return;
      }
    } else {
      // No "to" date - start from top (newest photos)
      scrollToTop();
      await wait(1000);
    }

    // Wait for photos to be ready
    await waitForMetadataLoaded();

    selection.phase = 'selecting';
    updateProgressLabel('Selecting...');
    updateProgressStatus('');

    // Run selection loop
    await runSelectionLoop();

    // Complete
    const finalCount = selection.count;
    selection.isRunning = false;

    // Show completion state in modal (don't auto-close)
    showCompletionState(finalCount);
  }

  function showCompletionState(count) {
    // Restore scrubber to DOM now that scanning is complete
    restoreScrubberToDOM();

    if (!state.modal) return;

    const progressView = state.modal.querySelector('#gpc-progress-view');
    if (!progressView) return;

    // Update the progress view to show completion
    const spinner = progressView.querySelector('.gpc-spinner');
    const label = progressView.querySelector('.gpc-progress-label');
    const countEl = progressView.querySelector('#gpc-progress-count');
    const stopBtn = progressView.querySelector('[data-action="stop"]');

    // Hide spinner, show checkmark
    if (spinner) {
      spinner.style.display = 'none';
    }

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

    // Update count display
    if (countEl) {
      countEl.textContent = count.toLocaleString();
      if (count > 0) {
        countEl.style.color = '#22c55e';
      }
    }

    // Change stop button to done button
    if (stopBtn) {
      stopBtn.textContent = 'Done';
      stopBtn.classList.remove('stop');
      stopBtn.style.background = '#22c55e';
      stopBtn.dataset.action = 'done';
      stopBtn.onclick = closeModal;
    }
  }

  async function runSelectionLoop() {
    const processedElements = new Set();
    let noNewPhotosCount = 0;
    let stuckAtBottomCount = 0;
    let errorCount = 0;
    const MAX_NO_NEW = 3;
    const MAX_STUCK_AT_BOTTOM = 5; // Try 5 times before giving up when stuck
    const MAX_ERRORS = 5;
    const CLICK_DELAY = 100; // Delay between photo selections
    const MIN_SCROLL_SETTLE = 300; // Wait for scroll animation and lazy loading
    const TIMEOUT_MS = 360000; // 6 minutes
    const MAX_VIEWPORT_RETRIES = 3; // Max retries for unprocessed photos in viewport

    while (!selection.shouldStop) {
      // Check for timeout (6 minutes)
      if (Date.now() - selection.startTime > TIMEOUT_MS) {
        showTimeoutPrompt();
        // Wait for user decision
        while (selection.isPaused && !selection.shouldStop) {
          await wait(100);
        }
        if (selection.shouldStop) break;
      }

      try {
        // Process current viewport with retries for photos missing metadata
        let viewportRetries = 0;
        let foundNew = false;
        let oldestDateInBatch = null;
        let passedTargetRange = false;
        let skippedDueToNoMetadata = 0;

        while (viewportRetries < MAX_VIEWPORT_RETRIES) {
          const photos = findPhotoContainers();

          // Check if we can find any photos
          if (photos.length === 0 && processedElements.size === 0) {
            errorCount++;
            if (errorCount >= MAX_ERRORS) {
              showErrorToast('Unable to find photos. Google may have updated their UI.');
              return;
            }
            await wait(1000);
            break;
          }

          errorCount = 0;
          skippedDueToNoMetadata = 0;

          for (const container of photos) {
            if (selection.shouldStop) break;

            // Generate unique key - MUST be content-based, not position-based
            // Google Photos virtualizes the list and recycles DOM elements at same positions
            const checkbox = getCheckbox(container);
            const photoEl = container.querySelector('[data-latest-bg]');
            const ariaLabel = checkbox?.getAttribute('aria-label');
            const bgUrl = photoEl?.getAttribute('data-latest-bg');

            // Require a stable content-based key - track if metadata not loaded yet
            if (!ariaLabel && !bgUrl) {
              skippedDueToNoMetadata++;
              continue;
            }

            // Use background URL as primary key (unique per photo), aria-label as fallback
            const key = bgUrl || ariaLabel;

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
            const shouldSelect = matchesFilters(container);
            const alreadySelected = isSelected(container);

            if (!shouldSelect) {
              console.log('Google Photos Cleaner: Photo does not match filters, skipping');
              continue;
            }

            if (alreadySelected) {
              console.log('Google Photos Cleaner: Photo already selected, skipping');
              continue;
            }

            // This photo matches filters and is not selected - try to select it
            try {
              const selected = await selectPhoto(container);
              if (selected) {
                selection.count++;
                updateProgressCount(selection.count);
                console.log(`Google Photos Cleaner: Selected photo #${selection.count}`);
              } else {
                // Selection failed - log details for debugging
                const metadata = getPhotoMetadata(container);
                console.warn('Google Photos Cleaner: FAILED to select photo that should be selected!',
                  'Date:', metadata?.date?.toDateString(),
                  'Key:', key.substring(0, 50) + '...');
              }
            } catch (e) {
              console.warn('Failed to select photo:', e);
            }

            await wait(CLICK_DELAY);
          }

          // If we skipped photos due to missing metadata, wait and retry
          if (skippedDueToNoMetadata > 0 && viewportRetries < MAX_VIEWPORT_RETRIES - 1) {
            console.log(`Google Photos Cleaner: ${skippedDueToNoMetadata} photos without metadata, waiting and retrying (attempt ${viewportRetries + 1})`);
            await wait(500);
            await waitForMetadataLoaded(0.9, 2000, 100);
            viewportRetries++;
          } else {
            break; // All photos processed or max retries reached
          }
        }

        if (skippedDueToNoMetadata > 0) {
          console.log(`Google Photos Cleaner: Still ${skippedDueToNoMetadata} photos without metadata after retries, proceeding`);
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

        // Track scroll position before scrolling
        const posBefore = getScrollPosition();

        // Scroll down
        scrollDown();
        await wait(MIN_SCROLL_SETTLE); // Let scroll animation start
        await waitForMetadataLoaded(); // Wait for photos to load their metadata

        // Check if we made progress (scroll position changed or content height increased)
        const posAfter = getScrollPosition();
        const madeProgress = posAfter.scrollTop > posBefore.scrollTop || posAfter.scrollHeight > posBefore.scrollHeight;

        console.log('Google Photos Cleaner: Scroll progress -',
          'before:', posBefore.scrollTop, '/', posBefore.scrollHeight,
          'after:', posAfter.scrollTop, '/', posAfter.scrollHeight,
          'progress:', madeProgress);

        // Determine if we should stop
        if (!foundNew) {
          noNewPhotosCount++;

          // If we have a "from" date, we need to keep scrolling until we reach it
          if (filters.dateRange.from) {
            // Only stop if we're truly stuck (no scroll progress after multiple attempts)
            if (!madeProgress) {
              stuckAtBottomCount++;
              console.log(`Google Photos Cleaner: Stuck at bottom, attempt ${stuckAtBottomCount}/${MAX_STUCK_AT_BOTTOM}`);
              if (stuckAtBottomCount >= MAX_STUCK_AT_BOTTOM) {
                console.log('Google Photos Cleaner: Reached end of library');
                break;
              }
              // Try scrolling again after a short wait
              await wait(125);
            } else {
              stuckAtBottomCount = 0; // Reset if we made progress
            }
          } else {
            // No "from" date - use original logic
            if (noNewPhotosCount >= MAX_NO_NEW || isAtBottom()) {
              break;
            }
          }
        } else {
          noNewPhotosCount = 0;
          stuckAtBottomCount = 0;
        }

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

  function updateProgressCount(count) {
    if (!state.modal) return;
    const countEl = state.modal.querySelector('#gpc-progress-count');
    if (countEl) {
      countEl.textContent = count.toLocaleString();
    }
  }

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

  function showToast(count) {
    const toast = document.createElement('div');
    toast.className = 'gpc-toast';
    toast.innerHTML = `
      <span class="gpc-toast-icon">&#10003;</span>
      <span>${count.toLocaleString()} photos selected</span>
    `;
    state.container.appendChild(toast);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function showErrorToast(message) {
    const toast = document.createElement('div');
    toast.className = 'gpc-toast';
    toast.style.background = '#7f1d1d';
    toast.innerHTML = `
      <span class="gpc-toast-icon" style="color: #fca5a5;">!</span>
      <span>${message}</span>
    `;
    state.container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  function showNoMatchToast() {
    const toast = document.createElement('div');
    toast.className = 'gpc-toast';
    toast.style.background = '#78350f';
    toast.innerHTML = `
      <span class="gpc-toast-icon" style="color: #fcd34d;">!</span>
      <span>No photos matched your filters</span>
    `;
    state.container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectTriggerButton);
  } else {
    // Use setTimeout to ensure Google Photos UI has rendered
    setTimeout(injectTriggerButton, 500);
  }

  // Re-inject if header changes (Google Photos is an SPA)
  const observer = new MutationObserver(() => {
    if (!document.getElementById('gpc-trigger-button')) {
      injectTriggerButton();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
