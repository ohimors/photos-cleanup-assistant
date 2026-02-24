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

  // Placeholder for styles - will be expanded in Task 4
  function getStyles() {
    return `
      #gpc-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
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
