const {
  parseDate,
  isDateInRange,
  isBeforeFromDate,
  isAfterToDate,
  formatDateForDisplay,
  getFileType,
  getOrientationFromDimensions,
  matchesFilters
} = require('../src/lib/filters');

describe('parseDate', () => {
  const referenceDate = new Date('2026-02-25T12:00:00');

  test('parses "Today" correctly', () => {
    const result = parseDate('Today', referenceDate);
    expect(result).toEqual(new Date('2026-02-25T00:00:00'));
  });

  test('parses "today" (lowercase) correctly', () => {
    const result = parseDate('today', referenceDate);
    expect(result).toEqual(new Date('2026-02-25T00:00:00'));
  });

  test('parses "Yesterday" correctly', () => {
    const result = parseDate('Yesterday', referenceDate);
    expect(result).toEqual(new Date('2026-02-24T00:00:00'));
  });

  test('parses ISO date string', () => {
    // Note: Date.parse('2026-02-23') parses as UTC midnight
    // The result may show different local date depending on timezone
    const result = parseDate('2026-02-23');
    expect(result).not.toBeNull();
    // Just verify it's a valid date in Feb 2026
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(1); // February is month 1
    // Date could be 22 or 23 depending on timezone
    expect([22, 23]).toContain(result.getDate());
  });

  test('parses "February 23, 2026"', () => {
    const result = parseDate('February 23, 2026');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(23);
  });

  test('parses "Feb 23, 2026"', () => {
    const result = parseDate('Feb 23, 2026');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(23);
  });

  test('parses "Monday, February 23, 2026"', () => {
    const result = parseDate('Monday, February 23, 2026');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(23);
  });

  test('returns null for invalid input', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate('not a date')).toBeNull();
  });
});

describe('isDateInRange', () => {
  test('returns true when date is within range', () => {
    const date = new Date('2026-02-23T12:00:00');
    expect(isDateInRange(date, '2026-02-22', '2026-02-24')).toBe(true);
  });

  test('returns true when date equals from date (start of range)', () => {
    const date = new Date('2026-02-22T00:00:00');
    expect(isDateInRange(date, '2026-02-22', '2026-02-24')).toBe(true);
  });

  test('returns true when date equals to date (end of range)', () => {
    const date = new Date('2026-02-24T23:59:59');
    expect(isDateInRange(date, '2026-02-22', '2026-02-24')).toBe(true);
  });

  test('returns false when date is before range', () => {
    const date = new Date('2026-02-21T12:00:00');
    expect(isDateInRange(date, '2026-02-22', '2026-02-24')).toBe(false);
  });

  test('returns false when date is after range', () => {
    const date = new Date('2026-02-25T12:00:00');
    expect(isDateInRange(date, '2026-02-22', '2026-02-24')).toBe(false);
  });

  test('returns true when only fromDate is set and date is after', () => {
    const date = new Date('2026-02-25T12:00:00');
    expect(isDateInRange(date, '2026-02-22', null)).toBe(true);
  });

  test('returns true when only toDate is set and date is before', () => {
    const date = new Date('2026-02-20T12:00:00');
    expect(isDateInRange(date, null, '2026-02-24')).toBe(true);
  });

  test('returns false for null date', () => {
    expect(isDateInRange(null, '2026-02-22', '2026-02-24')).toBe(false);
  });

  test('returns false for invalid date', () => {
    expect(isDateInRange(new Date('invalid'), '2026-02-22', '2026-02-24')).toBe(false);
  });

  test('returns true when no range specified', () => {
    const date = new Date('2026-02-23T12:00:00');
    expect(isDateInRange(date, null, null)).toBe(true);
  });
});

describe('isBeforeFromDate', () => {
  test('returns true when photo date is before from date', () => {
    const photoDate = new Date('2026-01-15T12:00:00');
    expect(isBeforeFromDate(photoDate, '2026-02-01')).toBe(true);
  });

  test('returns false when photo date equals from date', () => {
    const photoDate = new Date('2026-02-01T12:00:00');
    expect(isBeforeFromDate(photoDate, '2026-02-01')).toBe(false);
  });

  test('returns false when photo date is after from date', () => {
    const photoDate = new Date('2026-02-15T12:00:00');
    expect(isBeforeFromDate(photoDate, '2026-02-01')).toBe(false);
  });

  test('returns false when fromDate is null', () => {
    const photoDate = new Date('2026-01-15T12:00:00');
    expect(isBeforeFromDate(photoDate, null)).toBe(false);
  });

  test('returns false when photoDate is null', () => {
    expect(isBeforeFromDate(null, '2026-02-01')).toBe(false);
  });

  test('returns false when photoDate is invalid', () => {
    expect(isBeforeFromDate(new Date('invalid'), '2026-02-01')).toBe(false);
  });
});

describe('isAfterToDate', () => {
  test('returns true when photo date is after to date', () => {
    const photoDate = new Date('2026-02-15T12:00:00');
    expect(isAfterToDate(photoDate, '2026-02-01')).toBe(true);
  });

  test('returns false when photo date equals to date', () => {
    const photoDate = new Date('2026-02-01T12:00:00');
    expect(isAfterToDate(photoDate, '2026-02-01')).toBe(false);
  });

  test('returns false when photo date is before to date', () => {
    const photoDate = new Date('2026-01-15T12:00:00');
    expect(isAfterToDate(photoDate, '2026-02-01')).toBe(false);
  });

  test('returns false when toDate is null', () => {
    const photoDate = new Date('2026-02-15T12:00:00');
    expect(isAfterToDate(photoDate, null)).toBe(false);
  });

  test('returns false when photoDate is null', () => {
    expect(isAfterToDate(null, '2026-02-01')).toBe(false);
  });
});

describe('formatDateForDisplay', () => {
  test('formats date as "Mon YYYY"', () => {
    // Use explicit time to avoid timezone issues
    expect(formatDateForDisplay(new Date('2026-02-15T12:00:00'))).toBe('Feb 2026');
    expect(formatDateForDisplay(new Date('2024-12-25T12:00:00'))).toBe('Dec 2024');
    expect(formatDateForDisplay(new Date('2023-01-15T12:00:00'))).toBe('Jan 2023');
  });

  test('returns "Unknown" for null date', () => {
    expect(formatDateForDisplay(null)).toBe('Unknown');
  });

  test('returns "Unknown" for invalid date', () => {
    expect(formatDateForDisplay(new Date('invalid'))).toBe('Unknown');
  });

  test('returns "Unknown" for undefined', () => {
    expect(formatDateForDisplay(undefined)).toBe('Unknown');
  });
});

describe('getFileType', () => {
  test('detects video from hasVideoIndicator', () => {
    expect(getFileType({ hasVideoIndicator: true })).toBe('video');
  });

  test('detects video from label containing "video"', () => {
    expect(getFileType({ label: 'My Video.mp4' })).toBe('video');
    expect(getFileType({ label: 'VIDEO_20260223.mp4' })).toBe('video');
  });

  test('detects video from duration in textContent', () => {
    expect(getFileType({ textContent: '0:30' })).toBe('video');
    expect(getFileType({ textContent: '1:23' })).toBe('video');
    expect(getFileType({ textContent: '1:23:45' })).toBe('video');
  });

  test('detects RAW files from label', () => {
    expect(getFileType({ label: 'IMG_1234.DNG' })).toBe('raw');
    expect(getFileType({ label: 'photo.cr2' })).toBe('raw');
    expect(getFileType({ label: 'image.CR3' })).toBe('raw');
    expect(getFileType({ label: 'DSC_0001.NEF' })).toBe('raw');
    expect(getFileType({ label: 'photo.arw' })).toBe('raw');
  });

  test('defaults to photo for regular images', () => {
    expect(getFileType({ label: 'IMG_1234.jpg' })).toBe('photo');
    expect(getFileType({ label: 'photo.png' })).toBe('photo');
    expect(getFileType({})).toBe('photo');
  });
});

describe('getOrientationFromDimensions', () => {
  test('detects landscape (width > height * 1.1)', () => {
    expect(getOrientationFromDimensions(1920, 1080)).toBe('landscape');
    expect(getOrientationFromDimensions(4000, 3000)).toBe('landscape');
  });

  test('detects portrait (height > width * 1.1)', () => {
    expect(getOrientationFromDimensions(1080, 1920)).toBe('portrait');
    expect(getOrientationFromDimensions(3000, 4000)).toBe('portrait');
  });

  test('detects square (ratio between 0.9 and 1.1)', () => {
    expect(getOrientationFromDimensions(1000, 1000)).toBe('square');
    expect(getOrientationFromDimensions(1000, 1050)).toBe('square');
    expect(getOrientationFromDimensions(1050, 1000)).toBe('square');
  });

  test('returns unknown for invalid dimensions', () => {
    expect(getOrientationFromDimensions(0, 0)).toBe('unknown');
    expect(getOrientationFromDimensions(null, 100)).toBe('unknown');
    expect(getOrientationFromDimensions(100, null)).toBe('unknown');
    expect(getOrientationFromDimensions(-100, 100)).toBe('unknown');
  });
});

describe('matchesFilters', () => {
  const defaultFilters = {
    fileType: { photos: true, videos: true, raw: false },
    dateRange: { from: null, to: null },
    orientation: 'any'
  };

  test('matches photo when photos filter is enabled', () => {
    const photo = { fileType: 'photo', date: new Date(), width: 1920, height: 1080 };
    expect(matchesFilters(photo, defaultFilters)).toBe(true);
  });

  test('does not match photo when photos filter is disabled', () => {
    const photo = { fileType: 'photo', date: new Date(), width: 1920, height: 1080 };
    const filters = { ...defaultFilters, fileType: { photos: false, videos: true, raw: false } };
    expect(matchesFilters(photo, filters)).toBe(false);
  });

  test('matches video when videos filter is enabled', () => {
    const video = { fileType: 'video', date: new Date(), width: 1920, height: 1080 };
    expect(matchesFilters(video, defaultFilters)).toBe(true);
  });

  test('does not match video when videos filter is disabled', () => {
    const video = { fileType: 'video', date: new Date(), width: 1920, height: 1080 };
    const filters = { ...defaultFilters, fileType: { photos: true, videos: false, raw: false } };
    expect(matchesFilters(video, filters)).toBe(false);
  });

  test('does not match RAW when raw filter is disabled', () => {
    const raw = { fileType: 'raw', date: new Date(), width: 1920, height: 1080 };
    expect(matchesFilters(raw, defaultFilters)).toBe(false);
  });

  test('matches RAW when raw filter is enabled', () => {
    const raw = { fileType: 'raw', date: new Date(), width: 1920, height: 1080 };
    const filters = { ...defaultFilters, fileType: { photos: true, videos: true, raw: true } };
    expect(matchesFilters(raw, filters)).toBe(true);
  });

  describe('date filtering', () => {
    test('matches photo within date range', () => {
      const photo = {
        fileType: 'photo',
        date: new Date('2026-02-23T12:00:00'),
        width: 1920,
        height: 1080
      };
      const filters = {
        ...defaultFilters,
        dateRange: { from: '2026-02-22', to: '2026-02-24' }
      };
      expect(matchesFilters(photo, filters)).toBe(true);
    });

    test('does not match photo outside date range (too early)', () => {
      const photo = {
        fileType: 'photo',
        date: new Date('2026-02-21T12:00:00'),
        width: 1920,
        height: 1080
      };
      const filters = {
        ...defaultFilters,
        dateRange: { from: '2026-02-22', to: '2026-02-24' }
      };
      expect(matchesFilters(photo, filters)).toBe(false);
    });

    test('does not match photo outside date range (too late)', () => {
      const photo = {
        fileType: 'photo',
        date: new Date('2026-02-25T12:00:00'),
        width: 1920,
        height: 1080
      };
      const filters = {
        ...defaultFilters,
        dateRange: { from: '2026-02-22', to: '2026-02-24' }
      };
      expect(matchesFilters(photo, filters)).toBe(false);
    });

    test('does not match photo when date is null and date filter is active', () => {
      const photo = {
        fileType: 'photo',
        date: null,
        width: 1920,
        height: 1080
      };
      const filters = {
        ...defaultFilters,
        dateRange: { from: '2026-02-22', to: '2026-02-24' }
      };
      expect(matchesFilters(photo, filters)).toBe(false);
    });

    test('matches photo with null date when no date filter is set', () => {
      const photo = {
        fileType: 'photo',
        date: null,
        width: 1920,
        height: 1080
      };
      expect(matchesFilters(photo, defaultFilters)).toBe(true);
    });
  });

  describe('orientation filtering', () => {
    test('matches landscape photo when orientation filter is landscape', () => {
      const photo = {
        fileType: 'photo',
        date: new Date(),
        width: 1920,
        height: 1080
      };
      const filters = { ...defaultFilters, orientation: 'landscape' };
      expect(matchesFilters(photo, filters)).toBe(true);
    });

    test('does not match portrait photo when orientation filter is landscape', () => {
      const photo = {
        fileType: 'photo',
        date: new Date(),
        width: 1080,
        height: 1920
      };
      const filters = { ...defaultFilters, orientation: 'landscape' };
      expect(matchesFilters(photo, filters)).toBe(false);
    });

    test('matches any orientation when filter is "any"', () => {
      const landscape = { fileType: 'photo', date: new Date(), width: 1920, height: 1080 };
      const portrait = { fileType: 'photo', date: new Date(), width: 1080, height: 1920 };
      const square = { fileType: 'photo', date: new Date(), width: 1000, height: 1000 };

      expect(matchesFilters(landscape, defaultFilters)).toBe(true);
      expect(matchesFilters(portrait, defaultFilters)).toBe(true);
      expect(matchesFilters(square, defaultFilters)).toBe(true);
    });

    test('orientation filter does not affect videos', () => {
      const video = {
        fileType: 'video',
        date: new Date(),
        width: 1080,
        height: 1920 // portrait
      };
      const filters = { ...defaultFilters, orientation: 'landscape' };
      expect(matchesFilters(video, filters)).toBe(true);
    });
  });
});
