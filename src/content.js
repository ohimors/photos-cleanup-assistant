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
