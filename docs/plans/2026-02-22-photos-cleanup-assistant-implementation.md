# Photos Cleanup Assistant Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Chrome extension that programmatically selects Google Photos by date range for manual cleanup.

**Architecture:** Manifest V3 extension with popup for batch management, service worker for storage coordination, and content script for DOM manipulation on photos.google.com. Communication via chrome.runtime messaging.

**Tech Stack:** Chrome Extension (MV3), vanilla JavaScript, chrome.storage.local, no external dependencies.

---

## Task 1: Project Structure and Manifest

**Files:**
- Create: `manifest.json`
- Create: `src/background.js`
- Create: `src/content.js`
- Create: `src/popup/popup.html`
- Create: `src/popup/popup.js`
- Create: `src/popup/popup.css`

**Step 1: Create directory structure**

```bash
mkdir -p src/popup src/options
```

**Step 2: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Photos Cleanup Assistant",
  "version": "0.1.0",
  "description": "Select Google Photos by date range for manual cleanup. Does not auto-delete.",
  "permissions": ["storage"],
  "host_permissions": ["https://photos.google.com/*"],
  "background": {
    "service_worker": "src/background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://photos.google.com/*"],
      "js": ["src/content.js"],
      "css": []
    }
  ],
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_title": "Photos Cleanup Assistant"
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

**Step 3: Create minimal background.js stub**

```javascript
// src/background.js
// Service worker for Photos Cleanup Assistant
console.log('Photos Cleanup Assistant: Service worker loaded');
```

**Step 4: Create minimal content.js stub**

```javascript
// src/content.js
// Content script for photos.google.com
console.log('Photos Cleanup Assistant: Content script loaded');
```

**Step 5: Create minimal popup.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div id="app">
    <h1>Photos Cleanup</h1>
    <p>Loading...</p>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

**Step 6: Create minimal popup.css**

```css
/* src/popup/popup.css */
body {
  width: 320px;
  min-height: 400px;
  margin: 0;
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
}

h1 {
  font-size: 18px;
  margin: 0 0 16px 0;
}
```

**Step 7: Create minimal popup.js**

```javascript
// src/popup/popup.js
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('app').innerHTML = `
    <h1>Photos Cleanup</h1>
    <p>Extension loaded successfully.</p>
  `;
});
```

**Step 8: Test manual load in Chrome**

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select project root
4. Verify extension loads without errors
5. Click extension icon → verify popup appears

**Step 9: Commit**

```bash
git add manifest.json src/
git commit -m "feat: add extension skeleton with manifest, popup, background, content script"
```

---

## Task 2: Storage Layer

**Files:**
- Create: `src/storage.js`
- Modify: `src/background.js`

**Step 1: Create storage.js with batch functions**

```javascript
// src/storage.js
// Storage utilities for batches and settings

const DEFAULT_SETTINGS = {
  scrollDelay: 400,
  clickDelay: 75,
  showProgressOverlay: true
};

async function getSettings() {
  const result = await chrome.storage.local.get('settings');
  return result.settings || DEFAULT_SETTINGS;
}

async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}

async function getBatches() {
  const result = await chrome.storage.local.get('batches');
  return result.batches || [];
}

async function saveBatch(batch) {
  const batches = await getBatches();
  const existingIndex = batches.findIndex(b => b.id === batch.id);
  if (existingIndex >= 0) {
    batches[existingIndex] = batch;
  } else {
    batches.push(batch);
  }
  await chrome.storage.local.set({ batches });
  return batch;
}

async function deleteBatch(batchId) {
  const batches = await getBatches();
  const filtered = batches.filter(b => b.id !== batchId);
  await chrome.storage.local.set({ batches: filtered });
}

function createBatch(name, startDate, endDate) {
  return {
    id: `batch_${Date.now()}`,
    name,
    startDate,
    endDate,
    status: 'pending',
    photosSelected: 0,
    createdAt: new Date().toISOString(),
    completedAt: null,
    notes: ''
  };
}

async function clearAllData() {
  await chrome.storage.local.clear();
}

async function exportData() {
  const batches = await getBatches();
  const settings = await getSettings();
  return { batches, settings, exportedAt: new Date().toISOString() };
}
```

**Step 2: Update manifest to load storage.js in background**

The service worker can import modules. Update `src/background.js`:

```javascript
// src/background.js
// Service worker for Photos Cleanup Assistant

importScripts('storage.js');

console.log('Photos Cleanup Assistant: Service worker loaded');

// Message handler for popup and content script communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'GET_BATCHES':
      return { batches: await getBatches() };

    case 'GET_SETTINGS':
      return { settings: await getSettings() };

    case 'SAVE_BATCH':
      return { batch: await saveBatch(message.batch) };

    case 'CREATE_BATCH':
      const batch = createBatch(message.name, message.startDate, message.endDate);
      return { batch: await saveBatch(batch) };

    case 'DELETE_BATCH':
      await deleteBatch(message.batchId);
      return { success: true };

    case 'SAVE_SETTINGS':
      await saveSettings(message.settings);
      return { success: true };

    case 'CLEAR_ALL_DATA':
      await clearAllData();
      return { success: true };

    case 'EXPORT_DATA':
      return { data: await exportData() };

    default:
      return { error: 'Unknown message type' };
  }
}
```

**Step 3: Test storage via console**

1. Reload extension in `chrome://extensions`
2. Go to extension service worker (click "service worker" link)
3. In console, test:
   ```javascript
   // Test createBatch and saveBatch
   const batch = createBatch('Test', '2021-01-01', '2021-12-31');
   await saveBatch(batch);
   console.log(await getBatches()); // Should show 1 batch

   // Test deleteBatch
   await deleteBatch(batch.id);
   console.log(await getBatches()); // Should be empty
   ```

**Step 4: Commit**

```bash
git add src/storage.js src/background.js
git commit -m "feat: add storage layer for batches and settings"
```

---

## Task 3: Popup UI - Batch List View

**Files:**
- Modify: `src/popup/popup.html`
- Modify: `src/popup/popup.js`
- Modify: `src/popup/popup.css`

**Step 1: Update popup.html with structure**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div id="app">
    <!-- Header -->
    <header class="header">
      <h1>Photos Cleanup</h1>
      <button id="settings-btn" class="icon-btn" title="Settings">&#9881;</button>
    </header>

    <!-- Main view: batch list -->
    <main id="batch-list-view">
      <button id="new-batch-btn" class="primary-btn">+ New Batch</button>
      <div id="batch-list"></div>
      <p id="empty-state" class="empty-state">No batches yet. Create one to get started.</p>
    </main>

    <!-- Create batch form (hidden by default) -->
    <section id="create-batch-view" class="hidden">
      <h2>New Batch</h2>
      <form id="batch-form">
        <label>
          Batch Name
          <input type="text" id="batch-name" placeholder="e.g., 2021 cleanup" required>
        </label>
        <label>
          Start Date
          <input type="date" id="start-date" required>
        </label>
        <label>
          End Date
          <input type="date" id="end-date" required>
        </label>
        <div class="form-actions">
          <button type="button" id="cancel-btn" class="secondary-btn">Cancel</button>
          <button type="submit" class="primary-btn">Start Selection</button>
        </div>
      </form>
    </section>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

**Step 2: Update popup.css with styles**

```css
/* src/popup/popup.css */
* {
  box-sizing: border-box;
}

body {
  width: 320px;
  min-height: 400px;
  margin: 0;
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #333;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

h1 {
  font-size: 18px;
  margin: 0;
}

h2 {
  font-size: 16px;
  margin: 0 0 16px 0;
}

.icon-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  color: #666;
}

.icon-btn:hover {
  color: #333;
}

.primary-btn {
  background: #1a73e8;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  width: 100%;
}

.primary-btn:hover {
  background: #1557b0;
}

.secondary-btn {
  background: #f1f3f4;
  color: #333;
  border: none;
  padding: 10px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.secondary-btn:hover {
  background: #e8eaed;
}

.hidden {
  display: none !important;
}

.empty-state {
  color: #666;
  text-align: center;
  padding: 32px 16px;
}

/* Batch list */
#batch-list {
  margin-top: 16px;
}

.batch-item {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
}

.batch-item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.batch-name {
  font-weight: 600;
  margin: 0;
}

.batch-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  background: #e8eaed;
}

.batch-status.completed {
  background: #e6f4ea;
  color: #137333;
}

.batch-status.in_progress {
  background: #fef7e0;
  color: #b45309;
}

.batch-dates {
  font-size: 12px;
  color: #666;
  margin: 4px 0;
}

.batch-count {
  font-size: 12px;
  color: #666;
}

/* Form */
form label {
  display: block;
  margin-bottom: 12px;
  font-weight: 500;
}

form input {
  display: block;
  width: 100%;
  margin-top: 4px;
  padding: 8px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  font-size: 14px;
}

form input:focus {
  outline: none;
  border-color: #1a73e8;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.form-actions button {
  flex: 1;
}
```

**Step 3: Update popup.js with batch list logic**

```javascript
// src/popup/popup.js

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await renderBatchList();
  setupEventListeners();
}

function setupEventListeners() {
  document.getElementById('new-batch-btn').addEventListener('click', showCreateForm);
  document.getElementById('cancel-btn').addEventListener('click', hideCreateForm);
  document.getElementById('batch-form').addEventListener('submit', handleCreateBatch);
}

function showCreateForm() {
  document.getElementById('batch-list-view').classList.add('hidden');
  document.getElementById('create-batch-view').classList.remove('hidden');
}

function hideCreateForm() {
  document.getElementById('create-batch-view').classList.add('hidden');
  document.getElementById('batch-list-view').classList.remove('hidden');
  document.getElementById('batch-form').reset();
}

async function handleCreateBatch(e) {
  e.preventDefault();

  const name = document.getElementById('batch-name').value.trim();
  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;

  if (!name || !startDate || !endDate) return;

  // Create batch via background script
  const response = await chrome.runtime.sendMessage({
    type: 'CREATE_BATCH',
    name,
    startDate,
    endDate
  });

  if (response.batch) {
    // Open Google Photos with date filter and start selection
    await startSelection(response.batch);
  }

  hideCreateForm();
  await renderBatchList();
}

async function startSelection(batch) {
  // Build Google Photos search URL with date range
  // Format: after:YYYY-MM-DD before:YYYY-MM-DD
  const searchQuery = `after:${batch.startDate} before:${batch.endDate}`;
  const url = `https://photos.google.com/search/${encodeURIComponent(searchQuery)}`;

  // Store the active batch ID for content script to pick up
  await chrome.storage.local.set({ activeBatchId: batch.id });

  // Open Google Photos in new tab
  await chrome.tabs.create({ url });
}

async function renderBatchList() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_BATCHES' });
  const batches = response.batches || [];

  const listEl = document.getElementById('batch-list');
  const emptyEl = document.getElementById('empty-state');

  if (batches.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  // Sort by createdAt descending (newest first)
  batches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  listEl.innerHTML = batches.map(batch => `
    <div class="batch-item" data-id="${batch.id}">
      <div class="batch-item-header">
        <p class="batch-name">${escapeHtml(batch.name)}</p>
        <span class="batch-status ${batch.status}">${formatStatus(batch.status)}</span>
      </div>
      <p class="batch-dates">${batch.startDate} to ${batch.endDate}</p>
      <p class="batch-count">${batch.photosSelected} photos selected</p>
    </div>
  `).join('');
}

function formatStatus(status) {
  const map = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    stopped: 'Stopped'
  };
  return map[status] || status;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

**Step 4: Test popup UI**

1. Reload extension
2. Click extension icon
3. Verify "Photos Cleanup" header and "New Batch" button appear
4. Click "New Batch" → form should appear
5. Click "Cancel" → should return to list view

**Step 5: Commit**

```bash
git add src/popup/
git commit -m "feat: add popup UI with batch list and create form"
```

---

## Task 4: Content Script - DOM Selectors

**Files:**
- Modify: `src/content.js`

**Step 1: Research Google Photos DOM structure**

Note: Google Photos DOM changes frequently. The selectors below are starting points and may need adjustment. The content script should log helpful debug info when selectors fail.

**Step 2: Create content.js with DOM helper functions**

```javascript
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
  // This is tricky - we'll need to trigger selection via click or keyboard
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

// Export for use in selection algorithm
window.PhotosCleanup = {
  findVisiblePhotos,
  isPhotoSelected,
  selectPhoto,
  scrollDown,
  scrollToTop,
  wait,
  getScrollInfo
};
```

**Step 3: Test selectors on Google Photos**

1. Reload extension
2. Navigate to https://photos.google.com
3. Open DevTools console
4. Run: `PhotosCleanup.findVisiblePhotos()`
5. Note: If returns empty array, inspect DOM and update selectors

**Step 4: Commit**

```bash
git add src/content.js
git commit -m "feat: add content script with DOM helper functions"
```

---

## Task 5: Content Script - Selection Algorithm

**Files:**
- Modify: `src/content.js`

**Step 1: Add selection state management**

Add to `src/content.js` before the exports:

```javascript
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
}

// Resume selection
async function resumeSelection() {
  if (!selectionState.isRunning) return;
  selectionState.isPaused = false;
  updateProgress(selectionState.selectedCount, 'Resuming...');
  await runSelectionLoop();
}

// Stop selection completely
function stopSelection() {
  selectionState.isRunning = false;
  selectionState.isPaused = false;
  updateProgress(selectionState.selectedCount, 'Stopped');

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

  // Notify background script
  chrome.runtime.sendMessage({
    type: 'SELECTION_COMPLETE',
    batchId: selectionState.batchId,
    photosSelected: selectionState.selectedCount
  });
}
```

**Step 2: Add message listener for commands**

Add to `src/content.js`:

```javascript
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
```

**Step 3: Commit**

```bash
git add src/content.js
git commit -m "feat: add selection algorithm with start/pause/stop controls"
```

---

## Task 6: Content Script - Progress Overlay

**Files:**
- Modify: `src/content.js`

**Step 1: Add progress overlay creation**

Add to `src/content.js`:

```javascript
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
}
```

**Step 2: Update exports**

Update the exports at the bottom of `src/content.js`:

```javascript
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
```

**Step 3: Test overlay manually**

1. Reload extension
2. Navigate to https://photos.google.com
3. In console: `PhotosCleanup.startSelection('test-batch', { clickDelay: 100, scrollDelay: 500 })`
4. Verify overlay appears and selection begins
5. Test Pause/Resume/Stop buttons

**Step 4: Commit**

```bash
git add src/content.js
git commit -m "feat: add progress overlay with pause/stop controls"
```

---

## Task 7: Message Passing Integration

**Files:**
- Modify: `src/background.js`
- Modify: `src/popup/popup.js`

**Step 1: Update background.js to handle selection events**

Add to the message handler in `src/background.js`:

```javascript
    case 'SELECTION_COMPLETE':
      const completedBatch = await updateBatchStatus(
        message.batchId,
        'completed',
        message.photosSelected
      );
      return { batch: completedBatch };

    case 'SELECTION_STOPPED':
      const stoppedBatch = await updateBatchStatus(
        message.batchId,
        'stopped',
        message.photosSelected
      );
      return { batch: stoppedBatch };

    case 'START_SELECTION_ON_TAB':
      // Send message to content script on active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url?.includes('photos.google.com')) {
        const settings = await getSettings();
        chrome.tabs.sendMessage(tab.id, {
          type: 'START_SELECTION',
          batchId: message.batchId,
          settings
        });
      }
      return { success: true };
```

**Step 2: Add updateBatchStatus helper to storage.js**

Add to `src/storage.js`:

```javascript
async function updateBatchStatus(batchId, status, photosSelected) {
  const batches = await getBatches();
  const batch = batches.find(b => b.id === batchId);
  if (batch) {
    batch.status = status;
    batch.photosSelected = photosSelected;
    if (status === 'completed' || status === 'stopped') {
      batch.completedAt = new Date().toISOString();
    }
    await chrome.storage.local.set({ batches });
    return batch;
  }
  return null;
}
```

**Step 3: Update popup to trigger selection on Google Photos tab**

Update `startSelection` function in `src/popup/popup.js`:

```javascript
async function startSelection(batch) {
  // Build Google Photos search URL with date range
  const searchQuery = `after:${batch.startDate} before:${batch.endDate}`;
  const url = `https://photos.google.com/search/${encodeURIComponent(searchQuery)}`;

  // Update batch status to in_progress
  batch.status = 'in_progress';
  await chrome.runtime.sendMessage({ type: 'SAVE_BATCH', batch });

  // Open Google Photos in new tab
  const tab = await chrome.tabs.create({ url });

  // Wait for tab to load, then start selection
  chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
    if (tabId === tab.id && changeInfo.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener);

      // Give the page a moment to fully render
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: 'START_SELECTION_ON_TAB',
          batchId: batch.id
        });
      }, 1500);
    }
  });
}
```

**Step 4: Test end-to-end flow**

1. Reload extension
2. Click extension icon → "New Batch"
3. Enter name, date range (use a small range for testing)
4. Click "Start Selection"
5. Verify: Google Photos opens, overlay appears, selection begins

**Step 5: Commit**

```bash
git add src/background.js src/storage.js src/popup/popup.js
git commit -m "feat: connect popup, background, and content script messaging"
```

---

## Task 8: Options Page

**Files:**
- Create: `src/options/options.html`
- Create: `src/options/options.js`
- Create: `src/options/options.css`
- Modify: `manifest.json`

**Step 1: Update manifest.json with options page**

Add to `manifest.json`:

```json
  "options_page": "src/options/options.html",
```

**Step 2: Create options.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Photos Cleanup Assistant - Settings</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <div class="container">
    <h1>Photos Cleanup Assistant Settings</h1>

    <section class="section">
      <h2>Selection Speed</h2>
      <p class="description">Slower speeds are safer and less likely to trigger rate limits.</p>

      <label>
        Click Delay (ms)
        <input type="number" id="click-delay" min="25" max="500" step="25">
        <span class="hint">Time between selecting each photo (50-100ms recommended)</span>
      </label>

      <label>
        Scroll Delay (ms)
        <input type="number" id="scroll-delay" min="200" max="2000" step="100">
        <span class="hint">Time to wait after scrolling for photos to load (300-500ms recommended)</span>
      </label>
    </section>

    <section class="section">
      <h2>Data Management</h2>

      <button id="export-btn" class="secondary-btn">Export All Data</button>
      <button id="clear-btn" class="danger-btn">Clear All Data</button>
    </section>

    <section class="section">
      <h2>About</h2>
      <p>Photos Cleanup Assistant helps you select Google Photos by date range for manual cleanup.</p>
      <p><strong>This extension does not delete photos.</strong> You always perform the final action.</p>
      <p>Version 0.1.0</p>
    </section>

    <div id="status" class="status hidden"></div>
  </div>

  <script src="options.js"></script>
</body>
</html>
```

**Step 3: Create options.css**

```css
/* src/options/options.css */
* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #333;
  background: #f5f5f5;
  margin: 0;
  padding: 24px;
}

.container {
  max-width: 600px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

h1 {
  font-size: 24px;
  margin: 0 0 24px 0;
}

h2 {
  font-size: 16px;
  margin: 0 0 8px 0;
}

.section {
  margin-bottom: 32px;
  padding-bottom: 32px;
  border-bottom: 1px solid #eee;
}

.section:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.description {
  color: #666;
  margin: 0 0 16px 0;
}

label {
  display: block;
  margin-bottom: 16px;
  font-weight: 500;
}

input[type="number"] {
  display: block;
  width: 120px;
  margin-top: 4px;
  padding: 8px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  font-size: 14px;
}

input:focus {
  outline: none;
  border-color: #1a73e8;
}

.hint {
  display: block;
  font-size: 12px;
  color: #666;
  font-weight: normal;
  margin-top: 4px;
}

.secondary-btn, .danger-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  margin-right: 8px;
}

.secondary-btn {
  background: #f1f3f4;
  color: #333;
}

.secondary-btn:hover {
  background: #e8eaed;
}

.danger-btn {
  background: #fce8e6;
  color: #c5221f;
}

.danger-btn:hover {
  background: #f8d7da;
}

.status {
  margin-top: 16px;
  padding: 12px;
  border-radius: 4px;
  background: #e6f4ea;
  color: #137333;
}

.status.error {
  background: #fce8e6;
  color: #c5221f;
}

.hidden {
  display: none;
}
```

**Step 4: Create options.js**

```javascript
// src/options/options.js

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadSettings();
  setupEventListeners();
}

async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  const settings = response.settings;

  document.getElementById('click-delay').value = settings.clickDelay;
  document.getElementById('scroll-delay').value = settings.scrollDelay;
}

function setupEventListeners() {
  // Auto-save on input change
  document.getElementById('click-delay').addEventListener('change', saveSettings);
  document.getElementById('scroll-delay').addEventListener('change', saveSettings);

  // Data management
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('clear-btn').addEventListener('click', clearData);
}

async function saveSettings() {
  const settings = {
    clickDelay: parseInt(document.getElementById('click-delay').value, 10),
    scrollDelay: parseInt(document.getElementById('scroll-delay').value, 10),
    showProgressOverlay: true
  };

  await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings });
  showStatus('Settings saved');
}

async function exportData() {
  const response = await chrome.runtime.sendMessage({ type: 'EXPORT_DATA' });
  const data = response.data;

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `photos-cleanup-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  URL.revokeObjectURL(url);
  showStatus('Data exported');
}

async function clearData() {
  if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) {
    return;
  }

  await chrome.runtime.sendMessage({ type: 'CLEAR_ALL_DATA' });
  showStatus('All data cleared');

  // Reload settings (will be defaults now)
  await loadSettings();
}

function showStatus(message, isError = false) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.classList.remove('hidden', 'error');
  if (isError) statusEl.classList.add('error');

  setTimeout(() => {
    statusEl.classList.add('hidden');
  }, 3000);
}
```

**Step 5: Test options page**

1. Reload extension
2. Right-click extension icon → "Options"
3. Verify settings load
4. Change a setting → verify "Settings saved" message
5. Click "Export All Data" → verify JSON downloads
6. Click "Clear All Data" → confirm → verify data cleared

**Step 6: Commit**

```bash
git add src/options/ manifest.json
git commit -m "feat: add options page with settings and data management"
```

---

## Task 9: Error Handling and Polish

**Files:**
- Modify: `src/content.js`

**Step 1: Add error handling to selection loop**

Update `runSelectionLoop` in `src/content.js` to handle errors:

```javascript
async function runSelectionLoop() {
  let noNewPhotosCount = 0;
  const MAX_NO_NEW_PHOTOS = 3;
  let consecutiveErrors = 0;
  const MAX_ERRORS = 5;

  while (selectionState.isRunning && !selectionState.isPaused) {
    try {
      const photos = findVisiblePhotos();

      // Check if we can find photos at all
      if (photos.length === 0 && selectionState.selectedCount === 0) {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_ERRORS) {
          updateProgress(0, 'Error: Cannot find photos. UI may have changed.');
          stopSelection();
          return;
        }
        await wait(1000); // Wait and retry
        continue;
      }

      consecutiveErrors = 0; // Reset on success
      let newPhotosFound = false;

      for (const photo of photos) {
        if (!selectionState.isRunning || selectionState.isPaused) break;

        const photoId = photo.getAttribute('data-item-id') ||
                        photo.getAttribute('data-id') ||
                        `el-${selectionState.processedElements.size}`;

        if (selectionState.processedElements.has(photoId)) continue;

        selectionState.processedElements.add(photoId);
        newPhotosFound = true;

        if (!isPhotoSelected(photo)) {
          try {
            await selectPhoto(photo);
            selectionState.selectedCount++;
            updateProgress(selectionState.selectedCount);
          } catch (e) {
            console.warn('Failed to select photo:', e);
            // Continue with next photo
          }
          await wait(selectionState.settings.clickDelay);
        }
      }

      const scrollInfo = getScrollInfo();
      if (!newPhotosFound) {
        noNewPhotosCount++;
        if (noNewPhotosCount >= MAX_NO_NEW_PHOTOS || scrollInfo.atBottom) {
          break;
        }
      } else {
        noNewPhotosCount = 0;
      }

      scrollDown();
      await wait(selectionState.settings.scrollDelay);

    } catch (error) {
      console.error('Selection loop error:', error);
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_ERRORS) {
        updateProgress(selectionState.selectedCount, 'Error: Selection failed. Try again.');
        stopSelection();
        return;
      }
      await wait(1000);
    }
  }

  if (selectionState.isRunning && !selectionState.isPaused) {
    completeSelection();
  }
}
```

**Step 2: Add page navigation detection**

Add to `src/content.js`:

```javascript
// Detect if user navigates away from photos
let lastUrl = location.href;
const urlObserver = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;

    // If selection is running and we left the search results
    if (selectionState.isRunning && !location.href.includes('photos.google.com/search')) {
      pauseSelection();
      updateProgress(selectionState.selectedCount, 'Paused: Navigate back to continue');
    }
  }
});

urlObserver.observe(document.body, { childList: true, subtree: true });
```

**Step 3: Commit**

```bash
git add src/content.js
git commit -m "feat: add error handling and navigation detection"
```

---

## Task 10: Final Testing and README

**Files:**
- Create: `README.md`
- Create: `PRIVACY.md`

**Step 1: Create README.md**

```markdown
# Photos Cleanup Assistant

A Chrome extension that helps you select Google Photos by date range for manual cleanup.

**This extension does NOT delete photos.** It selects photos matching your criteria, then you manually choose what to do with them (Download, Delete, Add to Album).

## Installation (Development)

1. Clone this repository
2. Open `chrome://extensions` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the project folder

## Usage

1. Click the extension icon
2. Click "New Batch"
3. Enter a name and date range
4. Click "Start Selection"
5. Watch as photos are automatically selected
6. When done, manually click Download, Delete, or other actions

## Features

- **Date range selection**: Select all photos within a date range
- **Progress tracking**: See how many photos are selected in real-time
- **Pause/Resume**: Take a break and continue later
- **Batch history**: Keep track of cleanup sessions
- **Adjustable speed**: Configure selection timing in settings

## Privacy

- All processing happens locally in your browser
- No data is sent to external servers
- No Google account credentials are accessed
- See [PRIVACY.md](PRIVACY.md) for full details

## Limitations

- DOM selectors may break if Google updates their UI
- Large batches (2500+ photos) may take several minutes
- Selection requires the Google Photos tab to remain active

## License

MIT
```

**Step 2: Create PRIVACY.md**

```markdown
# Privacy Policy

Photos Cleanup Assistant is designed with privacy as a core principle.

## Data Collection

**What we access:**
- Photo thumbnails visible on screen (to identify selection targets)
- Date information displayed in the Google Photos UI

**What we store locally:**
- Batch metadata (name, date range, count)
- User preferences (selection speed settings)

**What we NEVER collect:**
- Full-resolution photos
- Photo content or image data
- Google account credentials
- Browsing history outside photos.google.com

## Data Storage

All data is stored locally in your browser using Chrome's `chrome.storage.local` API. No data leaves your device.

## Data Deletion

You can delete all extension data at any time:
1. Right-click the extension icon → "Options"
2. Click "Clear All Data"

Or uninstall the extension, which removes all stored data.

## Permissions

- `storage`: Store batch history and settings locally
- `host_permissions` for `photos.google.com`: Interact with Google Photos UI

## Contact

For privacy questions, please open an issue on GitHub.
```

**Step 3: Manual test checklist**

Run through these tests before considering complete:

- [ ] Extension loads without errors
- [ ] Popup opens and displays correctly
- [ ] Can create a new batch with valid date range
- [ ] Google Photos opens with correct search filter
- [ ] Progress overlay appears
- [ ] Photos are selected (verify checkmarks appear)
- [ ] Pause button works
- [ ] Resume button works
- [ ] Stop button works
- [ ] Batch status updates to "completed"
- [ ] Batch history shows in popup
- [ ] Options page loads
- [ ] Settings save correctly
- [ ] Export data works
- [ ] Clear data works

**Step 4: Commit**

```bash
git add README.md PRIVACY.md
git commit -m "docs: add README and privacy policy"
```

---

## Summary

This plan covers 10 tasks that build the Photos Cleanup Assistant from scratch:

1. Project structure and manifest
2. Storage layer for batches/settings
3. Popup UI with batch list
4. Content script DOM selectors
5. Selection algorithm
6. Progress overlay
7. Message passing integration
8. Options page
9. Error handling
10. Documentation

Each task is broken into small steps following TDD principles where applicable. The extension avoids automated deletion and keeps all processing local, aligning with Chrome Web Store policies.
