/**
 * Metadata loading utilities for Google Photos Cleaner
 * Handles waiting for photo metadata (aria-labels) to load after scrolling
 */

/**
 * Count how many visible containers have their metadata (aria-label) loaded
 * @param {NodeList|Array} containers - Photo container elements
 * @param {Object} viewport - Viewport dimensions { innerHeight, innerWidth }
 * @param {string} checkboxSelector - CSS selector for checkbox elements
 * @returns {{ visible: number, withMetadata: number }}
 */
function countContainersWithMetadata(containers, viewport, checkboxSelector) {
  let withMetadata = 0;
  let visible = 0;

  for (const container of containers) {
    const rect = container.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0 &&
                      rect.top < viewport.innerHeight && rect.bottom > 0;
    if (!isVisible) continue;

    visible++;
    const checkbox = container.querySelector(checkboxSelector);
    if (checkbox && checkbox.getAttribute('aria-label')) {
      withMetadata++;
    }
  }

  return { visible, withMetadata };
}

/**
 * Check if enough visible containers have their metadata loaded
 * @param {NodeList|Array} containers - Photo container elements
 * @param {Object} viewport - Viewport dimensions { innerHeight, innerWidth }
 * @param {string} checkboxSelector - CSS selector for checkbox elements
 * @param {number} minRatio - Minimum ratio of loaded metadata (0-1)
 * @returns {boolean} - True if enough metadata is loaded
 */
function hasEnoughMetadata(containers, viewport, checkboxSelector, minRatio = 0.8) {
  const { visible, withMetadata } = countContainersWithMetadata(
    containers, viewport, checkboxSelector
  );

  if (visible === 0) return false;
  return withMetadata / visible >= minRatio;
}

/**
 * Create a metadata waiter function with the given configuration
 * Returns an async function that waits for metadata to load
 * @param {Object} config - Configuration
 * @param {Function} config.getContainers - Function to get container elements
 * @param {Function} config.getViewport - Function to get viewport dimensions
 * @param {string} config.checkboxSelector - CSS selector for checkboxes
 * @param {Function} config.wait - Async wait function (ms => Promise)
 * @param {Function} config.log - Logging function
 * @returns {Function} - Async function (minRatio, maxWaitMs, pollIntervalMs) => Promise<boolean>
 */
function createMetadataWaiter(config) {
  const {
    getContainers,
    getViewport,
    checkboxSelector,
    wait,
    log = console.log
  } = config;

  return async function waitForMetadataLoaded(
    minRatio = 0.8,
    maxWaitMs = 2000,
    pollIntervalMs = 100
  ) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const containers = getContainers();
      const viewport = getViewport();
      const { visible, withMetadata } = countContainersWithMetadata(
        containers, viewport, checkboxSelector
      );

      // If we have enough photos with metadata, we're good
      if (visible > 0 && withMetadata / visible >= minRatio) {
        log(`Metadata loaded (${withMetadata}/${visible} photos ready)`);
        return true;
      }

      // If no visible containers at all, wait a bit for DOM to update
      if (visible === 0) {
        await wait(pollIntervalMs);
        continue;
      }

      log(`Waiting for metadata (${withMetadata}/${visible} ready)...`);
      await wait(pollIntervalMs);
    }

    // Timeout reached, proceed anyway
    const containers = getContainers();
    const viewport = getViewport();
    const { visible, withMetadata } = countContainersWithMetadata(
      containers, viewport, checkboxSelector
    );
    log(`Metadata wait timeout (${withMetadata}/${visible} ready), proceeding`);
    return false;
  };
}

// Export for testing (CommonJS for Jest compatibility)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    countContainersWithMetadata,
    hasEnoughMetadata,
    createMetadataWaiter
  };
}

// Export for browser (ES modules)
if (typeof window !== 'undefined') {
  window.GPC_Metadata = {
    countContainersWithMetadata,
    hasEnoughMetadata,
    createMetadataWaiter
  };
}
