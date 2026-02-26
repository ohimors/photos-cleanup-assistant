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
    photoImage: '[data-latest-bg]'
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
    // Try to match date pattern after the orientation
    const dateMatch = ariaLabel.match(/(\w{3}\s+\d{1,2},\s+\d{4})/);
    if (dateMatch) {
      const parsed = Date.parse(dateMatch[1]);
      if (!isNaN(parsed)) {
        result.date = new Date(parsed);
      }
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
  function getCheckbox(container) {
    return container.querySelector(SELECTORS.photoCheckbox);
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

  // Select a photo by clicking its checkbox
  function selectPhoto(container) {
    // Trigger mouseenter to ensure checkbox is interactive
    container.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    container.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    const checkbox = getCheckbox(container);

    if (checkbox) {
      // Click the checkbox directly
      checkbox.click();
      console.log('Google Photos Cleaner: Clicked checkbox for photo');
      return true;
    }

    // No checkbox found
    console.warn('Google Photos Cleaner: Could not find checkbox for photo container');
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

    // Switch to progress view
    selection.isRunning = true;
    selection.count = 0;
    selection.shouldStop = false;
    selection.phase = 'scanning';
    selection.currentDateViewing = null;
    selection.startTime = Date.now();
    selection.isPaused = false;

    const filterView = state.modal.querySelector('#gpc-filter-view');
    const progressView = state.modal.querySelector('#gpc-progress-view');
    filterView.style.display = 'none';
    progressView.style.display = 'block';

    updateProgressCount(0);
    updateProgressLabel('Scanning...');
    updateProgressStatus('');

    // Scroll to top first
    scrollToTop();
    await wait(500);

    // Run selection loop
    await runSelectionLoop();

    // Complete
    const finalCount = selection.count;
    selection.isRunning = false;

    // Show completion state in modal (don't auto-close)
    showCompletionState(finalCount);
  }

  function showCompletionState(count) {
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
    const CLICK_DELAY = 75;
    const SCROLL_DELAY = 800; // Increased from 400ms for infinite scroll loading
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

        // Track scroll position before scrolling
        const posBefore = getScrollPosition();

        // Scroll down
        scrollDown();
        await wait(SCROLL_DELAY);

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
              // Try scrolling again after a longer wait
              await wait(500);
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
