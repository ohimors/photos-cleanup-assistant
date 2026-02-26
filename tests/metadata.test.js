/**
 * @jest-environment jsdom
 */

const {
  countContainersWithMetadata,
  hasEnoughMetadata,
  createMetadataWaiter
} = require('../src/lib/metadata');

// Helper to create mock photo container elements
function createMockContainer({ visible = true, hasCheckbox = true, hasAriaLabel = true, ariaLabel = 'Photo - Portrait - Feb 25, 2026' } = {}) {
  const container = document.createElement('div');
  container.className = 'rtIMgb';

  // Mock getBoundingClientRect
  container.getBoundingClientRect = () => ({
    top: visible ? 100 : -500,
    bottom: visible ? 200 : -400,
    left: 0,
    right: 100,
    width: visible ? 100 : 0,
    height: visible ? 100 : 0
  });

  if (hasCheckbox) {
    const checkbox = document.createElement('div');
    checkbox.setAttribute('role', 'checkbox');
    checkbox.className = 'ckGgle';
    if (hasAriaLabel) {
      checkbox.setAttribute('aria-label', ariaLabel);
    }
    container.appendChild(checkbox);
  }

  return container;
}

// Standard viewport for tests
const mockViewport = { innerHeight: 800, innerWidth: 1200 };
const checkboxSelector = '[role="checkbox"].ckGgle';

describe('countContainersWithMetadata', () => {
  test('counts visible containers with loaded metadata', () => {
    const containers = [
      createMockContainer({ visible: true, hasAriaLabel: true }),
      createMockContainer({ visible: true, hasAriaLabel: true }),
      createMockContainer({ visible: true, hasAriaLabel: false }),
    ];

    const result = countContainersWithMetadata(containers, mockViewport, checkboxSelector);

    expect(result.visible).toBe(3);
    expect(result.withMetadata).toBe(2);
  });

  test('excludes non-visible containers from count', () => {
    const containers = [
      createMockContainer({ visible: true, hasAriaLabel: true }),
      createMockContainer({ visible: false, hasAriaLabel: true }),
      createMockContainer({ visible: true, hasAriaLabel: true }),
    ];

    const result = countContainersWithMetadata(containers, mockViewport, checkboxSelector);

    expect(result.visible).toBe(2);
    expect(result.withMetadata).toBe(2);
  });

  test('handles containers without checkboxes', () => {
    const containers = [
      createMockContainer({ visible: true, hasCheckbox: true, hasAriaLabel: true }),
      createMockContainer({ visible: true, hasCheckbox: false }),
      createMockContainer({ visible: true, hasCheckbox: true, hasAriaLabel: true }),
    ];

    const result = countContainersWithMetadata(containers, mockViewport, checkboxSelector);

    expect(result.visible).toBe(3);
    expect(result.withMetadata).toBe(2);
  });

  test('returns zeros for empty container list', () => {
    const result = countContainersWithMetadata([], mockViewport, checkboxSelector);

    expect(result.visible).toBe(0);
    expect(result.withMetadata).toBe(0);
  });

  test('returns zeros when all containers are non-visible', () => {
    const containers = [
      createMockContainer({ visible: false }),
      createMockContainer({ visible: false }),
    ];

    const result = countContainersWithMetadata(containers, mockViewport, checkboxSelector);

    expect(result.visible).toBe(0);
    expect(result.withMetadata).toBe(0);
  });

  test('counts containers with empty aria-label as not having metadata', () => {
    const container = createMockContainer({ visible: true });
    container.querySelector(checkboxSelector).setAttribute('aria-label', '');

    const result = countContainersWithMetadata([container], mockViewport, checkboxSelector);

    expect(result.visible).toBe(1);
    expect(result.withMetadata).toBe(0);
  });
});

describe('hasEnoughMetadata', () => {
  test('returns true when ratio is met', () => {
    const containers = [
      createMockContainer({ visible: true, hasAriaLabel: true }),
      createMockContainer({ visible: true, hasAriaLabel: true }),
      createMockContainer({ visible: true, hasAriaLabel: true }),
      createMockContainer({ visible: true, hasAriaLabel: true }),
      createMockContainer({ visible: true, hasAriaLabel: false }),
    ];

    // 4/5 = 0.8, which meets the default 0.8 threshold
    expect(hasEnoughMetadata(containers, mockViewport, checkboxSelector, 0.8)).toBe(true);
  });

  test('returns false when ratio is not met', () => {
    const containers = [
      createMockContainer({ visible: true, hasAriaLabel: true }),
      createMockContainer({ visible: true, hasAriaLabel: true }),
      createMockContainer({ visible: true, hasAriaLabel: false }),
      createMockContainer({ visible: true, hasAriaLabel: false }),
      createMockContainer({ visible: true, hasAriaLabel: false }),
    ];

    // 2/5 = 0.4, which doesn't meet 0.8 threshold
    expect(hasEnoughMetadata(containers, mockViewport, checkboxSelector, 0.8)).toBe(false);
  });

  test('returns false when no visible containers', () => {
    const containers = [
      createMockContainer({ visible: false }),
    ];

    expect(hasEnoughMetadata(containers, mockViewport, checkboxSelector, 0.8)).toBe(false);
  });

  test('returns false for empty container list', () => {
    expect(hasEnoughMetadata([], mockViewport, checkboxSelector, 0.8)).toBe(false);
  });

  test('uses custom minRatio', () => {
    const containers = [
      createMockContainer({ visible: true, hasAriaLabel: true }),
      createMockContainer({ visible: true, hasAriaLabel: false }),
    ];

    // 1/2 = 0.5
    expect(hasEnoughMetadata(containers, mockViewport, checkboxSelector, 0.5)).toBe(true);
    expect(hasEnoughMetadata(containers, mockViewport, checkboxSelector, 0.6)).toBe(false);
  });
});

describe('createMetadataWaiter', () => {
  test('returns immediately when metadata is already loaded', async () => {
    const containers = [
      createMockContainer({ visible: true, hasAriaLabel: true }),
      createMockContainer({ visible: true, hasAriaLabel: true }),
    ];

    const logs = [];
    const waitForMetadataLoaded = createMetadataWaiter({
      getContainers: () => containers,
      getViewport: () => mockViewport,
      checkboxSelector,
      wait: () => Promise.resolve(),
      log: (msg) => logs.push(msg)
    });

    const result = await waitForMetadataLoaded(0.8, 2000, 100);

    expect(result).toBe(true);
    expect(logs[0]).toMatch(/Metadata loaded/);
  });

  test('waits and retries when metadata is not loaded', async () => {
    let callCount = 0;
    const getContainers = () => {
      callCount++;
      // First 2 calls: metadata not loaded, 3rd call: loaded
      if (callCount < 3) {
        return [
          createMockContainer({ visible: true, hasAriaLabel: false }),
          createMockContainer({ visible: true, hasAriaLabel: false }),
        ];
      }
      return [
        createMockContainer({ visible: true, hasAriaLabel: true }),
        createMockContainer({ visible: true, hasAriaLabel: true }),
      ];
    };

    const logs = [];
    const waitForMetadataLoaded = createMetadataWaiter({
      getContainers,
      getViewport: () => mockViewport,
      checkboxSelector,
      wait: () => Promise.resolve(), // Instant wait for testing
      log: (msg) => logs.push(msg)
    });

    const result = await waitForMetadataLoaded(0.8, 2000, 100);

    expect(result).toBe(true);
    expect(callCount).toBe(3);
    expect(logs.some(l => l.includes('Waiting for metadata'))).toBe(true);
    expect(logs.some(l => l.includes('Metadata loaded'))).toBe(true);
  });

  test('times out and returns false after maxWaitMs', async () => {
    const containers = [
      createMockContainer({ visible: true, hasAriaLabel: false }),
    ];

    const logs = [];
    let waitTime = 0;

    const waitForMetadataLoaded = createMetadataWaiter({
      getContainers: () => containers,
      getViewport: () => mockViewport,
      checkboxSelector,
      wait: async (ms) => {
        waitTime += ms;
        // Simulate time passing
        if (waitTime > 500) {
          // Force timeout by making Date.now return a late value
          jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 3000);
        }
      },
      log: (msg) => logs.push(msg)
    });

    const result = await waitForMetadataLoaded(0.8, 500, 100);

    expect(result).toBe(false);
    expect(logs.some(l => l.includes('timeout'))).toBe(true);

    jest.restoreAllMocks();
  });

  test('waits when no visible containers, then succeeds when they appear', async () => {
    let callCount = 0;
    const getContainers = () => {
      callCount++;
      if (callCount < 2) {
        return []; // No containers yet
      }
      return [
        createMockContainer({ visible: true, hasAriaLabel: true }),
      ];
    };

    const logs = [];
    const waitForMetadataLoaded = createMetadataWaiter({
      getContainers,
      getViewport: () => mockViewport,
      checkboxSelector,
      wait: () => Promise.resolve(),
      log: (msg) => logs.push(msg)
    });

    const result = await waitForMetadataLoaded(0.8, 2000, 100);

    expect(result).toBe(true);
    expect(callCount).toBe(2);
  });

  test('respects custom minRatio parameter', async () => {
    const containers = [
      createMockContainer({ visible: true, hasAriaLabel: true }),
      createMockContainer({ visible: true, hasAriaLabel: false }),
    ];

    const waitForMetadataLoaded = createMetadataWaiter({
      getContainers: () => containers,
      getViewport: () => mockViewport,
      checkboxSelector,
      wait: () => Promise.resolve(),
      log: () => {}
    });

    // 1/2 = 0.5, meets 0.5 threshold
    const result = await waitForMetadataLoaded(0.5, 2000, 100);
    expect(result).toBe(true);
  });
});
