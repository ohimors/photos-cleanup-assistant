// src/storage.js
// Storage utilities for batches and settings

const DEFAULT_SETTINGS = {
  scrollDelay: 400,
  clickDelay: 75,
  showProgressOverlay: true
};

async function getSettings() {
  const result = await chrome.storage.local.get('settings');
  return result.settings || DEFAULT_SETTINGS;
}

async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}

async function getBatches() {
  const result = await chrome.storage.local.get('batches');
  return result.batches || [];
}

async function saveBatch(batch) {
  const batches = await getBatches();
  const existingIndex = batches.findIndex(b => b.id === batch.id);
  if (existingIndex >= 0) {
    batches[existingIndex] = batch;
  } else {
    batches.push(batch);
  }
  await chrome.storage.local.set({ batches });
  return batch;
}

async function deleteBatch(batchId) {
  const batches = await getBatches();
  const filtered = batches.filter(b => b.id !== batchId);
  await chrome.storage.local.set({ batches: filtered });
}

function createBatch(name, startDate, endDate) {
  return {
    id: `batch_${Date.now()}`,
    name,
    startDate,
    endDate,
    status: 'pending',
    photosSelected: 0,
    createdAt: new Date().toISOString(),
    completedAt: null,
    notes: ''
  };
}

async function updateBatchStatus(batchId, status, photosSelected) {
  const batches = await getBatches();
  const batch = batches.find(b => b.id === batchId);
  if (batch) {
    batch.status = status;
    batch.photosSelected = photosSelected;
    if (status === 'completed' || status === 'stopped') {
      batch.completedAt = new Date().toISOString();
    }
    await chrome.storage.local.set({ batches });
    return batch;
  }
  return null;
}

async function clearAllData() {
  await chrome.storage.local.clear();
}

async function exportData() {
  const batches = await getBatches();
  const settings = await getSettings();
  return { batches, settings, exportedAt: new Date().toISOString() };
}
