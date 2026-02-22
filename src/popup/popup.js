// src/popup/popup.js

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await renderBatchList();
  setupEventListeners();
}

function setupEventListeners() {
  document.getElementById('new-batch-btn').addEventListener('click', showCreateForm);
  document.getElementById('cancel-btn').addEventListener('click', hideCreateForm);
  document.getElementById('batch-form').addEventListener('submit', handleCreateBatch);
  document.getElementById('settings-btn').addEventListener('click', openSettings);
}

function showCreateForm() {
  document.getElementById('batch-list-view').classList.add('hidden');
  document.getElementById('create-batch-view').classList.remove('hidden');
}

function hideCreateForm() {
  document.getElementById('create-batch-view').classList.add('hidden');
  document.getElementById('batch-list-view').classList.remove('hidden');
  document.getElementById('batch-form').reset();
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

async function handleCreateBatch(e) {
  e.preventDefault();

  const name = document.getElementById('batch-name').value.trim();
  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;

  if (!name || !startDate || !endDate) return;

  // Create batch via background script
  const response = await chrome.runtime.sendMessage({
    type: 'CREATE_BATCH',
    name,
    startDate,
    endDate
  });

  if (response.batch) {
    // Open Google Photos with date filter and start selection
    await startSelection(response.batch);
  }

  hideCreateForm();
  await renderBatchList();
}

async function startSelection(batch) {
  // Build Google Photos search URL with date range
  const searchQuery = `after:${batch.startDate} before:${batch.endDate}`;
  const url = `https://photos.google.com/search/${encodeURIComponent(searchQuery)}`;

  // Update batch status to in_progress
  batch.status = 'in_progress';
  await chrome.runtime.sendMessage({ type: 'SAVE_BATCH', batch });

  // Open Google Photos in new tab
  const tab = await chrome.tabs.create({ url });

  // Wait for tab to load, then start selection
  chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
    if (tabId === tab.id && changeInfo.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener);

      // Give the page a moment to fully render
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: 'START_SELECTION_ON_TAB',
          batchId: batch.id
        });
      }, 1500);
    }
  });
}

async function renderBatchList() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_BATCHES' });
  const batches = response.batches || [];

  const listEl = document.getElementById('batch-list');
  const emptyEl = document.getElementById('empty-state');

  if (batches.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  // Sort by createdAt descending (newest first)
  batches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  listEl.innerHTML = batches.map(batch => `
    <div class="batch-item" data-id="${batch.id}">
      <div class="batch-item-header">
        <p class="batch-name">${escapeHtml(batch.name)}</p>
        <span class="batch-status ${batch.status}">${formatStatus(batch.status)}</span>
      </div>
      <p class="batch-dates">${batch.startDate} to ${batch.endDate}</p>
      <p class="batch-count">${batch.photosSelected} photos selected</p>
    </div>
  `).join('');
}

function formatStatus(status) {
  const map = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    stopped: 'Stopped'
  };
  return map[status] || status;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
