/**
 * Filter logic for Google Photos Cleaner
 * Extracted for testability
 */

/**
 * Parse a date string into a Date object
 * Handles various formats: ISO, "January 15, 2024", "Today", "Yesterday", etc.
 * @param {string} dateString - The date string to parse
 * @param {Date} referenceDate - Reference date for relative dates (defaults to now)
 * @returns {Date|null} - Parsed date or null if unparseable
 */
function parseDate(dateString, referenceDate = new Date()) {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  const text = dateString.trim().toLowerCase();

  // Handle relative dates
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  if (text === 'today') {
    return today;
  }

  if (text === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }

  // Try parsing as a standard date
  const parsed = Date.parse(dateString.trim());
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }

  return null;
}

/**
 * Extract year, month, day from a date (ignoring time/timezone)
 * @param {Date} date - The date
 * @returns {{year: number, month: number, day: number}}
 */
function getDateParts(date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate()
  };
}

/**
 * Compare two dates by year, month, day only (ignoring time)
 * @param {Date} date1
 * @param {Date} date2
 * @returns {number} - negative if date1 < date2, 0 if equal, positive if date1 > date2
 */
function compareDatesOnly(date1, date2) {
  const d1 = getDateParts(date1);
  const d2 = getDateParts(date2);

  if (d1.year !== d2.year) return d1.year - d2.year;
  if (d1.month !== d2.month) return d1.month - d2.month;
  return d1.day - d2.day;
}

/**
 * Parse a date string to get year, month, day parts
 * Handles ISO format (YYYY-MM-DD) correctly without timezone issues
 * @param {string} dateString - Date string in ISO format
 * @returns {Date} - Date object set to local midnight
 */
function parseISODateString(dateString) {
  // Parse YYYY-MM-DD format manually to avoid timezone issues
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // JS months are 0-indexed
    const day = parseInt(match[3], 10);
    return new Date(year, month, day);
  }
  // Fallback to standard parsing
  return new Date(dateString);
}

/**
 * Check if a date is before the target "from" date (scrolled past target range)
 * Used for infinite scroll to know when to stop
 * @param {Date} photoDate - The photo's date
 * @param {string|null} fromDate - The "from" date filter (ISO format)
 * @returns {boolean} - True if photo is before the from date
 */
function isBeforeFromDate(photoDate, fromDate) {
  if (!fromDate) return false; // No from date means can't determine
  if (!photoDate || !(photoDate instanceof Date) || isNaN(photoDate.getTime())) {
    return false;
  }

  const from = parseISODateString(fromDate);
  return compareDatesOnly(photoDate, from) < 0;
}

/**
 * Check if a date is after the target "to" date (haven't reached target range yet)
 * Used for infinite scroll phase tracking
 * @param {Date} photoDate - The photo's date
 * @param {string|null} toDate - The "to" date filter (ISO format)
 * @returns {boolean} - True if photo is after the to date
 */
function isAfterToDate(photoDate, toDate) {
  if (!toDate) return false; // No to date means can't determine
  if (!photoDate || !(photoDate instanceof Date) || isNaN(photoDate.getTime())) {
    return false;
  }

  const to = parseISODateString(toDate);
  return compareDatesOnly(photoDate, to) > 0;
}

/**
 * Format a date as "Mon YYYY" for display (e.g., "Feb 2024")
 * @param {Date} date - The date to format
 * @returns {string} - Formatted string or "Unknown"
 */
function formatDateForDisplay(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return 'Unknown';
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Check if a date falls within a range
 * @param {Date} date - The date to check
 * @param {string|null} fromDate - Start of range (inclusive), ISO format (YYYY-MM-DD)
 * @param {string|null} toDate - End of range (inclusive), ISO format (YYYY-MM-DD)
 * @returns {boolean} - True if date is in range
 */
function isDateInRange(date, fromDate, toDate) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return false;
  }

  if (fromDate) {
    const from = parseISODateString(fromDate);
    if (compareDatesOnly(date, from) < 0) {
      return false;
    }
  }

  if (toDate) {
    const to = parseISODateString(toDate);
    if (compareDatesOnly(date, to) > 0) {
      return false;
    }
  }

  return true;
}

/**
 * Determine file type from metadata
 * @param {Object} metadata - Object with label, textContent, hasVideoIndicator
 * @returns {'photo'|'video'|'raw'} - The file type
 */
function getFileType(metadata) {
  const { label = '', textContent = '', hasVideoIndicator = false } = metadata;

  // Check for video
  if (hasVideoIndicator) return 'video';
  if (label.toLowerCase().includes('video')) return 'video';
  // Check for duration text (e.g., "0:30", "1:23:45")
  if (/\d+:\d{2}/.test(textContent)) return 'video';

  // Check for RAW
  if (/\.(dng|cr2|cr3|nef|arw|orf|rw2|raw)$/i.test(label)) return 'raw';

  return 'photo';
}

/**
 * Get orientation from dimensions
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {'landscape'|'portrait'|'square'|'unknown'} - The orientation
 */
function getOrientationFromDimensions(width, height) {
  if (!width || !height || width <= 0 || height <= 0) {
    return 'unknown';
  }

  const ratio = width / height;
  if (ratio > 1.1) return 'landscape';
  if (ratio < 0.9) return 'portrait';
  return 'square';
}

/**
 * Check if a photo matches the given filters
 * @param {Object} photoData - Photo metadata
 * @param {Object} filters - Filter criteria
 * @returns {boolean} - True if photo matches all filters
 */
function matchesFilters(photoData, filters) {
  const {
    fileType,
    date,
    width,
    height
  } = photoData;

  const {
    fileType: fileTypeFilters,
    dateRange,
    orientation: orientationFilter
  } = filters;

  // Check file type
  if (fileType === 'photo' && !fileTypeFilters.photos) return false;
  if (fileType === 'video' && !fileTypeFilters.videos) return false;
  if (fileType === 'raw' && !fileTypeFilters.raw) return false;

  // Check date range
  if (dateRange.from || dateRange.to) {
    if (!date) {
      // Can't determine date, skip this photo when date filter is active
      return false;
    }
    if (!isDateInRange(date, dateRange.from, dateRange.to)) {
      return false;
    }
  }

  // Check orientation (photos only)
  if (orientationFilter !== 'any' && fileType === 'photo') {
    const orientation = getOrientationFromDimensions(width, height);
    if (orientation !== 'unknown' && orientation !== orientationFilter) {
      return false;
    }
  }

  return true;
}

// Export for testing (CommonJS for Jest compatibility)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseDate,
    isDateInRange,
    isBeforeFromDate,
    isAfterToDate,
    formatDateForDisplay,
    getFileType,
    getOrientationFromDimensions,
    matchesFilters,
    parseISODateString,
    compareDatesOnly
  };
}

// Export for browser (ES modules)
if (typeof window !== 'undefined') {
  window.GPC_Filters = {
    parseDate,
    isDateInRange,
    isBeforeFromDate,
    isAfterToDate,
    formatDateForDisplay,
    getFileType,
    getOrientationFromDimensions,
    matchesFilters,
    parseISODateString,
    compareDatesOnly
  };
}
