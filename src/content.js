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
    shouldStop: false
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
    `;
  }

  // DOM Selectors - may need updating if Google changes their UI
  const SELECTORS = {
    // Photo grid items - Google uses various attributes
    photoItem: '[data-latest-bg], [data-media-key], [jsaction*="click:"]',
    // Video indicator - duration badge or play icon
    videoIndicator: '[data-video-preview], [aria-label*="Video"], [aria-label*="video"]',
    // Date headers in the photo grid
    dateHeader: '[data-date], [aria-label*="20"]',
    // Photo image element for orientation detection
    photoImage: 'img[src*="googleusercontent"]'
  };

  // Find all visible photo elements
  function findPhotoElements() {
    const items = document.querySelectorAll(SELECTORS.photoItem);
    return Array.from(items).filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }

  // Check if element is a video
  function isVideo(element) {
    // Check for video indicator within the element
    if (element.querySelector(SELECTORS.videoIndicator)) return true;
    // Check aria-label
    const label = element.getAttribute('aria-label') || '';
    if (label.toLowerCase().includes('video')) return true;
    // Check for duration text (e.g., "0:30")
    const text = element.textContent || '';
    if (/\d+:\d{2}/.test(text)) return true;
    return false;
  }

  // Check if element is a RAW file (limited detection)
  function isRaw(element) {
    const label = element.getAttribute('aria-label') || '';
    return /\.(dng|cr2|cr3|nef|arw|orf|rw2|raw)$/i.test(label);
  }

  // Get orientation from image dimensions
  function getOrientation(element) {
    const img = element.querySelector(SELECTORS.photoImage);
    if (!img) return 'unknown';

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    if (!width || !height) return 'unknown';

    const ratio = width / height;
    if (ratio > 1.1) return 'landscape';
    if (ratio < 0.9) return 'portrait';
    return 'square';
  }

  // Parse date from a date header element or text
  function parseDateHeader(element) {
    // Try data-date attribute first
    const dataDate = element.getAttribute('data-date');
    if (dataDate) {
      const date = new Date(dataDate);
      if (!isNaN(date.getTime())) {
        console.log('Google Photos Cleaner: Found date from data-date:', dataDate, '->', date);
        return date;
      }
    }

    // Try aria-label (e.g., "January 15, 2024" or "Feb 23, 2026")
    const label = element.getAttribute('aria-label') || '';
    if (label) {
      const parsed = Date.parse(label);
      if (!isNaN(parsed)) {
        const date = new Date(parsed);
        console.log('Google Photos Cleaner: Found date from aria-label:', label, '->', date);
        return date;
      }
    }

    // Try text content (e.g., "Today", "Yesterday", "Monday, February 23, 2026")
    const text = element.textContent?.trim() || '';
    if (text) {
      // Handle relative dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (text.toLowerCase() === 'today') {
        console.log('Google Photos Cleaner: Found date "Today" ->', today);
        return today;
      }
      if (text.toLowerCase() === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        console.log('Google Photos Cleaner: Found date "Yesterday" ->', yesterday);
        return yesterday;
      }

      // Try parsing the text directly
      const parsed = Date.parse(text);
      if (!isNaN(parsed)) {
        const date = new Date(parsed);
        console.log('Google Photos Cleaner: Found date from text:', text, '->', date);
        return date;
      }
    }

    return null;
  }

  // Find the date header for a photo element
  function findDateForPhoto(photoElement) {
    // Strategy 1: Look for date header in DOM hierarchy
    // Google Photos typically has date headers as siblings or ancestors of photo groups

    let current = photoElement;
    let depth = 0;
    const maxDepth = 10; // Don't go too far up

    while (current && depth < maxDepth) {
      // Check previous siblings for date headers
      let sibling = current.previousElementSibling;
      let siblingCount = 0;
      const maxSiblings = 20; // Don't check too many siblings

      while (sibling && siblingCount < maxSiblings) {
        // Look for elements that might be date headers
        const dateSelectors = [
          '[data-date]',
          '[role="heading"]',
          'h2', 'h3',
          '[class*="date"]',
          '[class*="Date"]'
        ];

        for (const selector of dateSelectors) {
          const dateEl = sibling.matches(selector) ? sibling : sibling.querySelector(selector);
          if (dateEl) {
            const date = parseDateHeader(dateEl);
            if (date) return date;
          }
        }

        // Also check the sibling itself for date-like text
        const siblingDate = parseDateHeader(sibling);
        if (siblingDate) return siblingDate;

        sibling = sibling.previousElementSibling;
        siblingCount++;
      }

      // Move up to parent
      current = current.parentElement;
      depth++;
    }

    console.log('Google Photos Cleaner: Could not find date for photo element');
    return null;
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

  // Check if photo matches current filters
  function matchesFilters(element) {
    // Check file type
    const isVid = isVideo(element);
    const isRawFile = isRaw(element);
    const isPhoto = !isVid && !isRawFile;

    if (isPhoto && !filters.fileType.photos) return false;
    if (isVid && !filters.fileType.videos) return false;
    if (isRawFile && !filters.fileType.raw) return false;

    // Check date range
    if (filters.dateRange.from || filters.dateRange.to) {
      const photoDate = findDateForPhoto(element);

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
      const orientation = getOrientation(element);
      if (orientation !== 'unknown' && orientation !== filters.orientation) {
        return false;
      }
    }

    return true;
  }

  // Check if element is already selected
  function isSelected(element) {
    // Google Photos shows selection state via various attributes
    if (element.getAttribute('aria-selected') === 'true') return true;
    if (element.querySelector('[aria-checked="true"]')) return true;
    if (element.querySelector('[role="checkbox"][aria-checked="true"]')) return true;
    // Check for selection checkmark or selected class
    if (element.querySelector('svg[data-icon="check"], .check-icon')) return true;
    if (element.classList.contains('selected')) return true;
    // Check for Google's selection indicator classes
    if (element.querySelector('.ckGgle.checked, .jfk-checkbox-checked')) return true;
    return false;
  }

  // Select a photo element by clicking its checkbox
  function selectPhoto(element) {
    // Google Photos shows a checkbox on hover - we need to find and click it
    // The checkbox may be hidden until hover, so we trigger hover first

    // Trigger mouseenter to reveal checkbox
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    // Small delay to let checkbox appear
    // Look for checkbox elements - Google Photos uses various selectors
    const checkboxSelectors = [
      '[role="checkbox"]',
      '[aria-checked]',
      'input[type="checkbox"]',
      '[data-selection-toggle]',
      '.ckGgle',  // Google's checkbox class
      '[jsaction*="select"]',
      '[jsaction*="toggle"]'
    ];

    let checkbox = null;
    for (const selector of checkboxSelectors) {
      checkbox = element.querySelector(selector);
      if (checkbox) break;
    }

    if (checkbox) {
      // Click the checkbox directly
      checkbox.click();
      return true;
    }

    // No checkbox found - do NOT click the element (would navigate away)
    console.warn('Google Photos Cleaner: Could not find checkbox for photo element');
    return false;
  }

  // Scroll helpers
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function scrollDown() {
    window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isAtBottom() {
    return (window.scrollY + window.innerHeight) >= (document.documentElement.scrollHeight - 100);
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
        <p class="gpc-progress-label">Selecting...</p>
        <p class="gpc-progress-count" id="gpc-progress-count">0</p>
        <button class="gpc-action-btn stop" data-action="stop">Stop Selection</button>
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

    const filterView = state.modal.querySelector('#gpc-filter-view');
    const progressView = state.modal.querySelector('#gpc-progress-view');
    filterView.style.display = 'none';
    progressView.style.display = 'block';

    updateProgressCount(0);

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
      if (count === 0) {
        label.textContent = 'No photos matched your filters';
        label.style.color = '#f59e0b';
      } else {
        label.textContent = 'Selection complete!';
        label.style.color = '#22c55e';
      }
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
    let errorCount = 0;
    const MAX_NO_NEW = 3;
    const MAX_ERRORS = 5;
    const CLICK_DELAY = 75;
    const SCROLL_DELAY = 400;

    while (!selection.shouldStop) {
      try {
        const photos = findPhotoElements();

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

        for (const photo of photos) {
          if (selection.shouldStop) break;

          const key = photo.getAttribute('data-media-key') ||
                      photo.getAttribute('data-latest-bg') ||
                      photo.getBoundingClientRect().top + '-' + photo.getBoundingClientRect().left;

          if (processedElements.has(key)) continue;
          processedElements.add(key);
          foundNew = true;

          if (!matchesFilters(photo)) continue;
          if (isSelected(photo)) continue;

          try {
            const selected = selectPhoto(photo);
            if (selected) {
              selection.count++;
              updateProgressCount(selection.count);
            }
          } catch (e) {
            console.warn('Failed to select photo:', e);
          }

          await wait(CLICK_DELAY);
        }

        if (!foundNew) {
          noNewPhotosCount++;
          if (noNewPhotosCount >= MAX_NO_NEW || isAtBottom()) {
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
  }

  function updateProgressCount(count) {
    if (!state.modal) return;
    const countEl = state.modal.querySelector('#gpc-progress-count');
    if (countEl) {
      countEl.textContent = count.toLocaleString();
    }
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
