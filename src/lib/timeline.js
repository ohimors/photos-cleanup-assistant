/**
 * Timeline navigation utilities for Google Photos Cleaner
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

function parseYearFromText(text) {
  if (!text) return null;
  const trimmed = text.trim();
  const year = parseInt(trimmed, 10);
  if (isNaN(year) || year < 1900 || year > 2100) {
    return null;
  }
  return year;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { findTargetYear, parseYearFromText };
}

if (typeof window !== 'undefined') {
  window.GPC_Timeline = { findTargetYear, parseYearFromText };
}
