// src/background.js
// Service worker for Google Photos Cleaner

const DEFAULT_PREFERENCES = {
  lastUsedFilters: {
    fileType: { photos: true, videos: true, raw: false },
    dateRange: { from: null, to: null },
    orientation: 'any'
  },
  scrollDelay: 400,
  clickDelay: 75
};

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case 'GET_PREFERENCES':
      return await getPreferences();

    case 'SAVE_PREFERENCES':
      await savePreferences(message.preferences);
      return { success: true };

    case 'SAVE_FILTERS':
      const prefs = await getPreferences();
      prefs.lastUsedFilters = message.filters;
      await savePreferences(prefs);
      return { success: true };

    default:
      return { error: 'Unknown message type' };
  }
}

async function getPreferences() {
  const result = await chrome.storage.local.get('preferences');
  return result.preferences || DEFAULT_PREFERENCES;
}

async function savePreferences(preferences) {
  await chrome.storage.local.set({ preferences });
}

console.log('Google Photos Cleaner: Service worker loaded');
