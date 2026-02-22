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
