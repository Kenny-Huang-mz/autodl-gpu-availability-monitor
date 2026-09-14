chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'GPU_AVAILABLE') return;
  chrome.notifications.create(`autodl-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'AutoDL：GPU 已充足',
    message: message.summary || '监控实例已有可用 GPU',
    priority: 2,
    requireInteraction: true
  });
});

chrome.notifications.onClicked.addListener(() => {
  chrome.windows.getAll({ populate: true }, (windows) => {
    for (const window of windows) {
      const tab = window.tabs?.find((item) => /^https:\/\/(www\.|console\.)?autodl\.com\/console\/instance/.test(item.url || ''));
      if (!tab) continue;
      chrome.windows.update(window.id, { focused: true });
      chrome.tabs.update(tab.id, { active: true });
      break;
    }
  });
});
