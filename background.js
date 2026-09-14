async function ensureOffscreenDocument() {
  if (!chrome.offscreen) return false;
  const url = chrome.runtime.getURL('offscreen.html');
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] });
  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play the user-configured GPU availability alarm.'
    });
  }
  return true;
}

async function playAlarm() {
  try {
    if (await ensureOffscreenDocument()) chrome.runtime.sendMessage({ type: 'OFFSCREEN_PLAY_TONE' });
  } catch (error) {
    console.warn('Unable to play the GPU alarm:', error);
  }
}

async function createNotification(summary) {
  try {
    await chrome.notifications.create(`autodl-${Date.now()}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'AutoDL：GPU 已充足',
      message: summary || '监控实例已有可用 GPU',
      priority: 2,
      requireInteraction: true
    });
  } catch (error) {
    console.warn('Unable to create the GPU notification:', error);
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'GPU_AVAILABLE') {
    createNotification(message.summary);
  }
  if (message?.type === 'PLAY_ALARM') playAlarm();
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
