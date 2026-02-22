// src/background.js
// Service worker for Photos Cleanup Assistant

importScripts('storage.js');

console.log('Photos Cleanup Assistant: Service worker loaded');

// Message handler for popup and content script communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'GET_BATCHES':
      return { batches: await getBatches() };

    case 'GET_SETTINGS':
      return { settings: await getSettings() };

    case 'SAVE_BATCH':
      return { batch: await saveBatch(message.batch) };

    case 'CREATE_BATCH':
      const batch = createBatch(message.name, message.startDate, message.endDate);
      return { batch: await saveBatch(batch) };

    case 'DELETE_BATCH':
      await deleteBatch(message.batchId);
      return { success: true };

    case 'SAVE_SETTINGS':
      await saveSettings(message.settings);
      return { success: true };

    case 'CLEAR_ALL_DATA':
      await clearAllData();
      return { success: true };

    case 'EXPORT_DATA':
      return { data: await exportData() };

    case 'SELECTION_COMPLETE':
      const completedBatch = await updateBatchStatus(
        message.batchId,
        'completed',
        message.photosSelected
      );
      return { batch: completedBatch };

    case 'SELECTION_STOPPED':
      const stoppedBatch = await updateBatchStatus(
        message.batchId,
        'stopped',
        message.photosSelected
      );
      return { batch: stoppedBatch };

    case 'START_SELECTION_ON_TAB':
      // Send message to content script on active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url?.includes('photos.google.com')) {
        const settings = await getSettings();
        chrome.tabs.sendMessage(tab.id, {
          type: 'START_SELECTION',
          batchId: message.batchId,
          settings
        });
      }
      return { success: true };

    default:
      return { error: 'Unknown message type' };
  }
}
