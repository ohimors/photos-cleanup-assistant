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

  // Inject trigger button into Google Photos header
  function injectTriggerButton() {
    // Google Photos header contains the search bar and action buttons
    // Look for the header element - this selector may need updating if Google changes their UI
    const headerSelectors = [
      'header',
      '[role="banner"]',
      'c-wiz > div > div > header'
    ];

    let header = null;
    for (const selector of headerSelectors) {
      header = document.querySelector(selector);
      if (header) break;
    }

    if (!header) {
      console.warn('Google Photos Cleaner: Could not find header element');
      // Retry after delay
      setTimeout(injectTriggerButton, 1000);
      return;
    }

    // Check if button already exists
    if (document.getElementById('gpc-trigger-button')) {
      return;
    }

    // Create trigger button
    const button = document.createElement('button');
    button.id = 'gpc-trigger-button';
    button.textContent = 'Cleaner';
    button.title = 'Google Photos Cleaner';
    button.style.cssText = `
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 18px;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      margin-left: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: background 0.2s;
    `;
    button.addEventListener('mouseenter', () => {
      button.style.background = '#2563eb';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '#3b82f6';
    });
    button.addEventListener('click', toggleModal);

    // Find a good insertion point in the header (right side)
    // Look for the profile/account button area
    const rightArea = header.querySelector('[data-ogpc]') ||
                      header.querySelector('a[href*="accounts.google.com"]')?.parentElement ||
                      header.lastElementChild;

    if (rightArea && rightArea.parentElement) {
      rightArea.parentElement.insertBefore(button, rightArea);
    } else {
      header.appendChild(button);
    }

    state.triggerButton = button;
    console.log('Google Photos Cleaner: Trigger button injected');
  }

  // Toggle modal open/closed
  function toggleModal() {
    if (state.isModalOpen) {
      closeModal();
    } else {
      openModal();
    }
  }

  // Placeholder functions - will be implemented in Task 5
  function openModal() {
    console.log('Opening modal...');
    state.isModalOpen = true;
  }

  function closeModal() {
    console.log('Closing modal...');
    state.isModalOpen = false;
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
