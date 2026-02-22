// src/content.js
// Content script for photos.google.com

console.log('Photos Cleanup Assistant: Content script loaded');

// DOM Selectors - may need updating if Google Photos changes
const SELECTORS = {
  // The main photo grid container
  photoGrid: '[data-photo-grid]',
  // Individual photo tiles (fallback patterns)
  photoTile: '[data-item-id], [data-id]',
  // The selection checkbox that appears on hover/selection
  photoContainer: '[role="listitem"], [data-tile-id]'
};

// Find all visible photo elements in the viewport
function findVisiblePhotos() {
  // Try multiple selector patterns since Google Photos DOM varies
  const selectors = [
    '[data-item-id]',
    '[data-id]',
    '[role="listitem"]'
  ];

  let photos = [];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      photos = Array.from(elements).filter(isInViewport);
      if (photos.length > 0) {
        console.log(`Found ${photos.length} photos using selector: ${selector}`);
        break;
      }
    }
  }

  if (photos.length === 0) {
    console.warn('Photos Cleanup: Could not find photo elements. DOM structure may have changed.');
  }

  return photos;
}

// Check if element is in the viewport
function isInViewport(el) {
  const rect = el.getBoundingClientRect();
  return (
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0
  );
}

// Check if a photo is already selected
function isPhotoSelected(photoEl) {
  // Google Photos shows a checkmark icon when selected
  // Look for aria-selected, checked state, or visual indicators
  if (photoEl.getAttribute('aria-selected') === 'true') return true;
  if (photoEl.classList.contains('selected')) return true;

  // Check for checkmark icon inside
  const checkmark = photoEl.querySelector('[aria-checked="true"], .check-icon, svg[data-icon="check"]');
  if (checkmark) return true;

  return false;
}

// Select a single photo by clicking it
async function selectPhoto(photoEl) {
  // In Google Photos, Shift+Click or Ctrl/Cmd+Click adds to selection
  // We simulate this by dispatching a click with modifier key
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
    ctrlKey: true,  // Ctrl+click to add to selection
    metaKey: true   // Cmd+click for Mac
  });

  photoEl.dispatchEvent(clickEvent);
}

// Scroll down by one viewport height
function scrollDown() {
  window.scrollBy({
    top: window.innerHeight * 0.8,
    behavior: 'smooth'
  });
}

// Scroll to top of page
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Wait for a specified duration
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get scroll position info for end detection
function getScrollInfo() {
  return {
    scrollY: window.scrollY,
    scrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    atBottom: (window.scrollY + window.innerHeight) >= (document.documentElement.scrollHeight - 100)
  };
}

// Progress overlay element reference
let overlayElement = null;

// Create and show the progress overlay
function showProgressOverlay() {
  if (overlayElement) return;

  overlayElement = document.createElement('div');
  overlayElement.id = 'photos-cleanup-overlay';
  overlayElement.innerHTML = `
    <div class="pca-overlay-content">
      <div class="pca-header">
        <span class="pca-title">Photos Cleanup Assistant</span>
        <button class="pca-close" title="Stop">&times;</button>
      </div>
      <div class="pca-progress">
        <span class="pca-count">0</span>
        <span class="pca-label">photos selected</span>
      </div>
      <div class="pca-status">Starting...</div>
      <div class="pca-actions">
        <button class="pca-btn pca-pause">Pause</button>
        <button class="pca-btn pca-stop">Stop</button>
      </div>
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.id = 'photos-cleanup-styles';
  style.textContent = `
    #photos-cleanup-overlay {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .pca-overlay-content {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.15);
      padding: 16px;
      min-width: 240px;
    }
    .pca-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .pca-title {
      font-weight: 600;
      font-size: 14px;
      color: #333;
    }
    .pca-close {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #666;
      padding: 0;
      line-height: 1;
    }
    .pca-close:hover { color: #333; }
    .pca-progress {
      text-align: center;
      margin-bottom: 8px;
    }
    .pca-count {
      font-size: 36px;
      font-weight: 700;
      color: #1a73e8;
    }
    .pca-label {
      display: block;
      font-size: 12px;
      color: #666;
    }
    .pca-status {
      text-align: center;
      font-size: 13px;
      color: #666;
      margin-bottom: 12px;
    }
    .pca-actions {
      display: flex;
      gap: 8px;
    }
    .pca-btn {
      flex: 1;
      padding: 8px 12px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .pca-pause {
      background: #f1f3f4;
      color: #333;
    }
    .pca-pause:hover { background: #e8eaed; }
    .pca-stop {
      background: #fce8e6;
      color: #c5221f;
    }
    .pca-stop:hover { background: #f8d7da; }
    .pca-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlayElement);

  // Attach event listeners
  overlayElement.querySelector('.pca-close').addEventListener('click', stopSelection);
  overlayElement.querySelector('.pca-pause').addEventListener('click', togglePause);
  overlayElement.querySelector('.pca-stop').addEventListener('click', stopSelection);
}

// Update progress display
function updateProgress(count, statusText) {
  if (!overlayElement) return;

  overlayElement.querySelector('.pca-count').textContent = count.toLocaleString();

  if (statusText) {
    overlayElement.querySelector('.pca-status').textContent = statusText;
  } else {
    overlayElement.querySelector('.pca-status').textContent = 'Selecting...';
  }

  // Update pause button text
  const pauseBtn = overlayElement.querySelector('.pca-pause');
  pauseBtn.textContent = selectionState.isPaused ? 'Resume' : 'Pause';
}

// Toggle pause/resume
function togglePause() {
  if (selectionState.isPaused) {
    resumeSelection();
  } else {
    pauseSelection();
  }
}

// Hide the overlay
function hideProgressOverlay() {
  if (overlayElement) {
    overlayElement.remove();
    overlayElement = null;
  }
  const style = document.getElementById('photos-cleanup-styles');
  if (style) style.remove();
}

// Selection state
let selectionState = {
  isRunning: false,
  isPaused: false,
  batchId: null,
  selectedCount: 0,
  processedElements: new Set(), // Track elements we've already processed
  settings: {
    scrollDelay: 400,
    clickDelay: 75
  }
};

// Start the selection process
async function startSelection(batchId, settings) {
  if (selectionState.isRunning) {
    console.log('Selection already in progress');
    return;
  }

  selectionState = {
    isRunning: true,
    isPaused: false,
    batchId,
    selectedCount: 0,
    processedElements: new Set(),
    settings: settings || selectionState.settings
  };

  console.log('Starting selection for batch:', batchId);

  showProgressOverlay();
  updateProgress(0, 'Starting selection...');

  // Scroll to top first
  scrollToTop();
  await wait(500);

  await runSelectionLoop();
}

// Main selection loop
async function runSelectionLoop() {
  let noNewPhotosCount = 0;
  const MAX_NO_NEW_PHOTOS = 3; // Stop after 3 scrolls with no new photos

  while (selectionState.isRunning && !selectionState.isPaused) {
    const photos = findVisiblePhotos();
    let newPhotosFound = false;

    for (const photo of photos) {
      if (!selectionState.isRunning || selectionState.isPaused) break;

      // Use element reference as key (or data-id if available)
      const photoId = photo.getAttribute('data-item-id') ||
                      photo.getAttribute('data-id') ||
                      photos.indexOf(photo).toString();

      if (selectionState.processedElements.has(photoId)) continue;

      selectionState.processedElements.add(photoId);
      newPhotosFound = true;

      if (!isPhotoSelected(photo)) {
        await selectPhoto(photo);
        selectionState.selectedCount++;
        updateProgress(selectionState.selectedCount);
        await wait(selectionState.settings.clickDelay);
      }
    }

    // Check if we've reached the end
    const scrollInfo = getScrollInfo();
    if (!newPhotosFound) {
      noNewPhotosCount++;
      if (noNewPhotosCount >= MAX_NO_NEW_PHOTOS || scrollInfo.atBottom) {
        // No new photos found, we're done
        break;
      }
    } else {
      noNewPhotosCount = 0;
    }

    // Scroll down for more photos
    scrollDown();
    await wait(selectionState.settings.scrollDelay);
  }

  // Selection complete
  if (selectionState.isRunning && !selectionState.isPaused) {
    completeSelection();
  }
}

// Pause selection
function pauseSelection() {
  selectionState.isPaused = true;
  updateProgress(selectionState.selectedCount, 'Paused');
  console.log('Selection paused at', selectionState.selectedCount, 'photos');
}

// Resume selection
async function resumeSelection() {
  if (!selectionState.isRunning) return;
  selectionState.isPaused = false;
  updateProgress(selectionState.selectedCount, 'Resuming...');
  console.log('Resuming selection...');
  await runSelectionLoop();
}

// Stop selection completely
function stopSelection() {
  selectionState.isRunning = false;
  selectionState.isPaused = false;
  updateProgress(selectionState.selectedCount, 'Stopped');
  console.log('Selection stopped at', selectionState.selectedCount, 'photos');

  // Notify background script
  chrome.runtime.sendMessage({
    type: 'SELECTION_STOPPED',
    batchId: selectionState.batchId,
    photosSelected: selectionState.selectedCount
  });
}

// Complete selection
function completeSelection() {
  selectionState.isRunning = false;
  updateProgress(selectionState.selectedCount, 'Complete!');
  console.log('Selection complete:', selectionState.selectedCount, 'photos selected');

  // Notify background script
  chrome.runtime.sendMessage({
    type: 'SELECTION_COMPLETE',
    batchId: selectionState.batchId,
    photosSelected: selectionState.selectedCount
  });
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_SELECTION':
      startSelection(message.batchId, message.settings);
      sendResponse({ success: true });
      break;

    case 'PAUSE_SELECTION':
      pauseSelection();
      sendResponse({ success: true });
      break;

    case 'RESUME_SELECTION':
      resumeSelection();
      sendResponse({ success: true });
      break;

    case 'STOP_SELECTION':
      stopSelection();
      sendResponse({ success: true });
      break;

    case 'GET_SELECTION_STATUS':
      sendResponse({
        isRunning: selectionState.isRunning,
        isPaused: selectionState.isPaused,
        selectedCount: selectionState.selectedCount
      });
      break;
  }
  return true;
});

// Export for debugging and testing
window.PhotosCleanup = {
  findVisiblePhotos,
  isPhotoSelected,
  selectPhoto,
  scrollDown,
  scrollToTop,
  wait,
  getScrollInfo,
  startSelection,
  pauseSelection,
  resumeSelection,
  stopSelection,
  getState: () => selectionState
};
