let activeAlert = null;

async function fetchAutoDLInstances(tabId) {
  if (!tabId) return { ok: false, error: '无法确定 AutoDL 页面' };
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async () => {
        try {
          const token = window.localStorage.getItem('token');
          if (!token) return { ok: false, error: '未检测到 AutoDL 登录状态' };

          let user = {};
          let appVersion = '0.0.0';
          try { user = JSON.parse(window.localStorage.getItem('user') || '{}'); } catch (_error) { /* use main account */ }
          try { appVersion = JSON.parse(window.localStorage.getItem('app_version') || '{}').version || appVersion; } catch (_error) { /* optional */ }

          const endpoint = user.sub_name ? '/api/v1/sub_user/instance' : '/api/v1/instance';
          const response = await window.fetch(endpoint, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Authorization: token,
              AppVersion: appVersion
            },
            body: JSON.stringify({
              page_index: 1,
              page_size: 1000,
              status: [],
              charge_type: [],
              name: '',
              sub_name: user.sub_name || ''
            })
          });
          const payload = await response.json();
          if (!response.ok || payload?.code !== 'Success') {
            return { ok: false, error: payload?.msg || `接口请求失败 (${response.status})` };
          }

          const data = payload?.data;
          const list = Array.isArray(data) ? data
            : Array.isArray(data?.list) ? data.list
              : Array.isArray(data?.result) ? data.result
                : [];
          return {
            ok: true,
            rows: list.map((row) => ({
              name: row?.name || '',
              uuid: row?.uuid || row?.instance_uuid || '',
              status: row?.status || '',
              start_mode: row?.start_mode || '',
              req_gpu_amount: row?.req_gpu_amount,
              gpu_idle_num: row?.gpu_idle_num,
              gpu_all_num: row?.gpu_all_num,
              machine_id: row?.machine_id || '',
              charge_type: row?.charge_type || ''
            }))
          };
        } catch (error) {
          return { ok: false, error: error?.message || '无法读取实例数据' };
        }
      }
    });
    return results?.[0]?.result || { ok: false, error: '未收到实例数据' };
  } catch (error) {
    return { ok: false, error: error?.message || '无法访问 AutoDL 页面' };
  }
}

async function ensureOffscreenDocument() {
  if (!chrome.offscreen) return false;
  const url = chrome.runtime.getURL('offscreen.html');
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] });
  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html', reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play the user-configured GPU availability alarm.'
    });
  }
  return true;
}

async function playAlarm(sound) {
  try {
    if (await ensureOffscreenDocument()) {
      let selected = sound;
      if (!selected) {
        const stored = await chrome.storage.sync.get({ config: { alarmSound: 'classic' } });
        selected = stored.config?.alarmSound || 'classic';
      }
      chrome.runtime.sendMessage({ type: 'OFFSCREEN_PLAY_TONE', sound: selected });
    }
  } catch (error) { console.warn('Unable to play the GPU alarm:', error); }
}

async function createNotification(summary) {
  try {
    await chrome.notifications.create(`autodl-${Date.now()}`, {
      type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'AutoDL：GPU 已充足', message: summary || '监控实例已有可用 GPU',
      priority: 2, requireInteraction: true
    });
  } catch (error) { console.warn('Unable to create the GPU notification:', error); }
}

function isInjectableUrl(url) {
  return /^https?:\/\//i.test(url || '');
}

async function ensureGlobalAlertInjected(tab) {
  if (!tab?.id || !isInjectableUrl(tab.url)) return false;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['global-alert.js'] });
    return true;
  } catch (error) {
    console.debug('Unable to inject the global alert into this page:', tab.url, error);
    return false;
  }
}

async function showAlertInTab(tab, alert) {
  if (!await ensureGlobalAlertInjected(tab)) return;
  try { await chrome.tabs.sendMessage(tab.id, { type: 'SHOW_GLOBAL_ALERT', alert }); } catch (_error) { /* page changed */ }
}

async function showAlertInCurrentTab(alert) {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tabs[0]) await showAlertInTab(tabs[0], alert);
}

async function broadcastAlert(alert) {
  activeAlert = alert;
  await chrome.storage.local.set({ activeAlert: alert });
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.filter((tab) => isInjectableUrl(tab.url)).map((tab) => showAlertInTab(tab, alert)));
}

async function updateAlert(patch) {
  if (!activeAlert) return;
  activeAlert = { ...activeAlert, ...patch };
  await chrome.storage.local.set({ activeAlert });
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.filter((tab) => isInjectableUrl(tab.url)).map((tab) => showAlertInTab(tab, activeAlert)));
}

async function clearAlert() {
  activeAlert = null;
  await chrome.storage.local.remove('activeAlert');
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.map((tab) => tab.id
    ? chrome.tabs.sendMessage(tab.id, { type: 'HIDE_GLOBAL_ALERT' })
    : Promise.resolve()));
}

async function focusAutoDL() {
  const windows = await chrome.windows.getAll({ populate: true });
  for (const window of windows) {
    const tab = window.tabs?.find((item) => /^https:\/\/(www\.|console\.)?autodl\.com\/console\/instance/.test(item.url || ''));
    if (!tab) continue;
    await chrome.windows.update(window.id, { focused: true });
    await chrome.tabs.update(tab.id, { active: true });
    return;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === 'FETCH_AUTODL_INSTANCES') {
      sendResponse(await fetchAutoDLInstances(sender.tab?.id));
      return;
    }
    if (message?.type === 'GPU_AVAILABLE') {
      const stored = await chrome.storage.sync.get({ config: { alarmMuted: false } });
      const alert = { signature: message.signature, names: message.names || [], summary: message.summary || '', sourceTabId: sender.tab?.id || null, muted: Boolean(stored.config?.alarmMuted) };
      await Promise.all([createNotification(alert.summary), broadcastAlert(alert)]);
    }
    if (message?.type === 'PLAY_ALARM') await playAlarm(message.sound);
    if (message?.type === 'GET_ACTIVE_ALERT') {
      if (!activeAlert) activeAlert = (await chrome.storage.local.get('activeAlert')).activeAlert || null;
      sendResponse({ alert: activeAlert });
    }
    if (message?.type === 'TOGGLE_GLOBAL_MUTE') {
      if (!activeAlert) return;
      const stored = await chrome.storage.sync.get({ config: {} });
      const config = { ...stored.config, alarmMuted: !Boolean(stored.config?.alarmMuted) };
      await chrome.storage.sync.set({ config });
      await updateAlert({ muted: config.alarmMuted });
    }
    if (message?.type === 'CLOSE_GLOBAL_ALERT') {
      const stored = await chrome.storage.sync.get({ config: { refreshSeconds: 60 } });
      const seconds = Math.max(5, Number(stored.config?.refreshSeconds) || 60);
      if (activeAlert?.sourceTabId) {
        try {
          await chrome.tabs.sendMessage(activeAlert.sourceTabId, {
            type: 'SCHEDULE_ALERT_REMINDER', signature: activeAlert.signature, seconds
          });
        } catch (_error) { /* tab closed */ }
      }
      await clearAlert();
    }
    if (message?.type === 'OPEN_AUTODL') await focusAutoDL();
    if (message?.type === 'GPU_UNAVAILABLE') await clearAlert();
    if (message?.type === 'TEST_GLOBAL_ALERT') {
      const stored = await chrome.storage.sync.get({ config: { alarmSound: 'classic' } });
      const alert = { signature: `test-${Date.now()}`, names: ['全局提醒测试成功'], summary: '这是一条测试提醒。', sourceTabId: null, muted: Boolean(stored.config?.alarmMuted) };
      await broadcastAlert(alert);
      if (!alert.muted) await playAlarm(stored.config?.alarmSound);
    }
  })().catch((error) => console.warn('Background action failed:', error));
  return true;
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  if (!activeAlert) activeAlert = (await chrome.storage.local.get('activeAlert')).activeAlert || null;
  if (!activeAlert) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    await showAlertInTab(tab, activeAlert);
  } catch (_error) { /* restricted page */ }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!activeAlert) activeAlert = (await chrome.storage.local.get('activeAlert')).activeAlert || null;
  if (activeAlert && tab.active) await showAlertInTab(tab, activeAlert);
});

chrome.notifications.onClicked.addListener(focusAutoDL);
