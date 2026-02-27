const { findTargetYear, parseYearFromText } = require('../src/lib/timeline');

describe('parseYearFromText', () => {
  test('parses valid year', () => {
    expect(parseYearFromText('2024')).toBe(2024);
    expect(parseYearFromText('2020')).toBe(2020);
  });

  test('handles whitespace', () => {
    expect(parseYearFromText('  2024  ')).toBe(2024);
  });

  test('returns null for invalid input', () => {
    expect(parseYearFromText(null)).toBeNull();
    expect(parseYearFromText('')).toBeNull();
    expect(parseYearFromText('not a year')).toBeNull();
  });

  test('returns null for unreasonable years', () => {
    expect(parseYearFromText('1800')).toBeNull();
    expect(parseYearFromText('2200')).toBeNull();
  });
});

describe('findTargetYear', () => {
  const years = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

  test('finds exact match', () => {
    expect(findTargetYear(years, 2024)).toEqual({ year: 2024, index: 2 });
  });

  test('finds nearest year when exact match not available', () => {
    expect(findTargetYear(years, 2017)).toEqual({ year: 2018, index: 8 });
  });

  test('returns null for empty array', () => {
    expect(findTargetYear([], 2024)).toBeNull();
  });

  test('returns null for null/undefined input', () => {
    expect(findTargetYear(null, 2024)).toBeNull();
  });
});
