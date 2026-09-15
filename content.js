(() => {
  'use strict';

  const defaults = { enabled: true, targets: [], refreshSeconds: 60, alarmMode: 'continuous', alarmSeconds: 15, alarmSound: 'classic', alarmMuted: false };
  let config = { ...defaults };
  let lastSignature = '';
  let alarmTimer = null;
  let reminderTimer = null;
  let reminderPaused = false;
  let reloadTimer = null;
  let scanTimer = null;
  let scanInFlight = false;
  let latestRows = [];
  let logs = [];
  let apiRows = [];
  let apiError = '';
  let apiFetchedAt = 0;

  const normalize = (value) => String(value || '').replace(/\s+/g, '').toLowerCase();
  const stamp = () => new Date().toLocaleTimeString();
  const addLog = (text) => { logs = [`${stamp()} ${text}`, ...logs].slice(0, 20); renderPanel(); };

  function countStatuses(text) {
    return (String(text || '').match(/已关机|运行中|开机中|关机中/g) || []).length;
  }

  function leafElementsContaining(target) {
    return [...document.querySelectorAll('body *')].filter((node) =>
      node.children.length === 0 && normalize(node.textContent).includes(normalize(target))
    );
  }

  function findInstanceRow(target) {
    for (const leaf of leafElementsContaining(target)) {
      let node = leaf;
      while (node && node !== document.body) {
        const raw = node.innerText || '';
        const statuses = countStatuses(raw);
        if (normalize(raw).includes(normalize(target)) && statuses === 1 && raw.includes('查看详情')) return node;
        if (statuses > 1) break;
        node = node.parentElement;
      }
    }
    return null;
  }

  const statusText = (status) => ({
    shutdown: '已关机', running: '运行中', starting: '开机中',
    stopping: '关机中', shutdown_by_starting_error: '已关机',
    shutdown_by_running_error: '已关机'
  })[status] || status || '状态未知';

  function findApiInstance(target) {
    const wanted = normalize(target);
    return apiRows.find((row) => normalize(row.name) === wanted || normalize(row.uuid) === wanted) || null;
  }

  function assessApiInstance(instance) {
    const mode = instance.start_mode === 'non_gpu' ? '无卡模式' : '';
    const status = statusText(instance.status);
    const canCheck = instance.status === 'shutdown' || (instance.status === 'running' && instance.start_mode === 'non_gpu');
    const idle = Number(instance.gpu_idle_num);
    const required = Number(instance.req_gpu_amount);
    const hasGpuNumbers = Number.isFinite(idle) && Number.isFinite(required) && required > 0;

    if (!canCheck) {
      return { available: false, availability: 'inactive', status: [status, mode].filter(Boolean).join(' / '), source: '实例接口' };
    }
    if (!hasGpuNumbers) {
      return { available: false, availability: 'unknown', status: [status, mode, 'GPU 状态未知'].filter(Boolean).join(' / '), source: '实例接口' };
    }

    const available = idle >= required;
    return {
      available,
      availability: available ? 'available' : 'unavailable',
      status: [status, mode, `GPU 空闲 ${idle}/${Number(instance.gpu_all_num) || '?'}`, `需要 ${required} 卡`].filter(Boolean).join(' / '),
      source: '实例接口'
    };
  }

  async function refreshApiRows(force = false) {
    const maxAge = Math.max(5, Number(config.refreshSeconds) || 60) * 1000;
    if (!force && apiFetchedAt && Date.now() - apiFetchedAt < maxAge) return;
    const response = await chrome.runtime.sendMessage({ type: 'FETCH_AUTODL_INSTANCES' });
    apiFetchedAt = Date.now();
    if (response?.ok) {
      apiRows = Array.isArray(response.rows) ? response.rows : [];
      apiError = '';
    } else {
      apiRows = [];
      apiError = response?.error || '实例接口暂时不可用';
    }
  }

  async function diagnose(forceApi = false) {
    await refreshApiRows(forceApi);
    const results = [];
    for (const target of config.targets) {
      const instance = findApiInstance(target);
      const row = findInstanceRow(target);
      if (instance) {
        const assessment = assessApiInstance(instance);
        results.push({
          target, found: true, ...assessment,
          preview: `${target} / ${assessment.status}`
        });
      } else if (!row) {
        results.push({
          target, found: false, available: false, availability: 'unknown',
          status: apiError ? `未识别到实例（${apiError}）` : '未识别到实例',
          source: apiError ? '页面兜底' : '实例接口'
        });
      } else {
        const raw = row.innerText || '';
        const noGpuMode = normalize(raw).includes(normalize('无卡模式'));
        const hasAvailableText = normalize(raw).includes(normalize('GPU充足'));
        results.push({
          target, found: true, available: hasAvailableText,
          availability: hasAvailableText ? 'available' : noGpuMode ? 'unknown' : 'unavailable',
          status: `${(raw.match(/已关机|运行中|开机中|关机中/) || ['状态未知'])[0]}${noGpuMode ? ' / 无卡模式 / GPU 状态未知' : ''}`,
          source: '页面兜底',
          preview: raw.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 7).join(' / ')
        });
      }
    }
    latestRows = results;
    chrome.storage.local.set({ latestDiagnostic: results, lastCheckedAt: Date.now() });
    return results;
  }

  function playTone() {
    chrome.runtime.sendMessage({ type: 'PLAY_ALARM', sound: config.alarmSound });
  }

  function stopAlarm() {
    if (alarmTimer) clearInterval(alarmTimer);
    alarmTimer = null;
  }

  function cancelReminder() {
    if (reminderTimer) clearTimeout(reminderTimer);
    reminderTimer = null;
    reminderPaused = false;
  }

  function scheduleReminder(signature, seconds) {
    stopAlarm();
    cancelReminder();
    reminderPaused = true;
    const delay = Math.max(5, Number(seconds) || config.refreshSeconds) * 1000;
    reminderTimer = setTimeout(async () => {
      reminderTimer = null;
      reminderPaused = false;
      const current = (await diagnose(true)).filter((row) => row.available).map((row) => row.target).sort().join('|');
      if (!current || current !== signature) return;
      const available = latestRows.filter((row) => row.available);
      startAlarm(signature);
      chrome.runtime.sendMessage({
        type: 'GPU_AVAILABLE', signature,
        names: available.map((row) => row.target),
        summary: available.map((row) => row.preview).join('\n')
      });
      addLog(`到达刷新间隔，GPU 仍然充足，再次提醒${config.alarmMuted ? '（静音）' : ''}`);
    }, delay);
  }

  function startAlarm(signature) {
    if (config.alarmMuted || reminderPaused || !signature) return;
    stopAlarm(); playTone();
    if (config.alarmMode === 'continuous') alarmTimer = setInterval(playTone, Math.max(5, config.alarmSeconds) * 1000);
  }

  function scheduleReload() {
    if (!config.enabled || reloadTimer) return;
    const base = Math.max(30, config.refreshSeconds) * 1000;
    const jitter = Math.round(base * (Math.random() * .2 - .1));
    reloadTimer = setTimeout(() => location.reload(), base + jitter);
  }

  async function scan() {
    if (scanInFlight) return;
    if (!config.enabled || config.targets.length === 0) { renderPanel(); return; }
    scanInFlight = true;
    try {
      const rows = await diagnose();
      const available = rows.filter((x) => x.available);
      const signature = available.map((x) => x.target).sort().join('|');

      if (signature) {
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = null;
        if (signature !== lastSignature) {
          startAlarm(signature);
          // 系统通知和本轮第一次响铃均由扩展后台处理，避免网页自动播放限制。
          chrome.runtime.sendMessage({
            type: 'GPU_AVAILABLE', signature,
            names: available.map((x) => x.target),
            summary: available.map((x) => x.preview).join('\n')
          });
          addLog(`发现 GPU 充足：${available.map((x) => x.target).join('、')}`);
        }
      } else {
        stopAlarm(); cancelReminder();
        if (lastSignature) {
          chrome.runtime.sendMessage({ type: 'GPU_UNAVAILABLE', signature: lastSignature });
          addLog('GPU 已不再充足，下一次释放将重新提醒');
        }
        scheduleReload();
      }
      lastSignature = signature; renderPanel();
    } finally {
      scanInFlight = false;
    }
  }

  function renderPanel() {
    let panel = document.getElementById('agm-panel');
    if (!panel) {
      panel = document.createElement('div'); panel.id = 'agm-panel';
      panel.innerHTML = '<div class="agm-head"><span>AutoDL GPU Monitor</span><span class="agm-toggle">−</span></div><div class="agm-body"></div>';
      panel.querySelector('.agm-head').onclick = () => { panel.classList.toggle('agm-collapsed'); panel.querySelector('.agm-toggle').textContent = panel.classList.contains('agm-collapsed') ? '+' : '−'; };
      document.body.appendChild(panel);
    }
    const found = latestRows.filter((x) => x.found).length;
    const available = latestRows.filter((x) => x.available).map((x) => x.target);
    const unknown = latestRows.filter((x) => x.availability === 'unknown').map((x) => x.target);
    const health = !config.enabled ? ['已暂停', 'agm-warn'] : config.targets.length === 0 ? ['尚未设置实例', 'agm-warn'] : found < config.targets.length ? [`识别异常 ${found}/${config.targets.length}`, 'agm-bad'] : ['运行正常', 'agm-ok'];
    panel.querySelector('.agm-body').innerHTML = `
      <div class="agm-row"><span>状态</span><span class="agm-value ${health[1]}">${health[0]}</span></div>
      <div class="agm-row"><span>监控目标</span><span class="agm-value">${config.targets.join('、') || '无'}</span></div>
      <div class="agm-row"><span>GPU 充足</span><span class="agm-value agm-ok">${available.join('、') || '无'}</span></div>
      <div class="agm-row"><span>状态未知</span><span class="agm-value ${unknown.length ? 'agm-warn' : ''}">${unknown.join('、') || '无'}</span></div>
      <div class="agm-row"><span>最近检查</span><span class="agm-value">${stamp()}</span></div>
      <div class="agm-row"><span>提醒</span><span class="agm-value">${config.alarmMode === 'continuous' ? `每 ${config.alarmSeconds} 秒响铃` : '仅响一次'} · ${({classic:'经典提示',double:'双响',digital:'数字警报',gentle:'柔和提示',urgent:'急促提醒'})[config.alarmSound] || '经典提示'}</span></div>
      <div class="agm-actions"><button data-agm="scan">立即检测</button><button data-agm="test">测试响铃</button><button data-agm="diagnose">复制诊断</button></div>
      <div class="agm-log">${logs.join('\n') || '等待检测…'}</div>`;
    panel.querySelector('[data-agm="scan"]').onclick = () => { apiFetchedAt = 0; scan(); };
    panel.querySelector('[data-agm="test"]').onclick = playTone;
    panel.querySelector('[data-agm="diagnose"]').onclick = async () => {
      const report = JSON.stringify({ url: location.href, time: new Date().toISOString(), targets: config.targets, rows: latestRows }, null, 2);
      await navigator.clipboard.writeText(report); addLog('诊断信息已复制');
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'SCAN') { scan(); sendResponse({ ok: true }); }
    if (message?.type === 'TEST_SOUND') { playTone(); sendResponse({ ok: true }); }
    if (message?.type === 'SCHEDULE_ALERT_REMINDER') {
      scheduleReminder(message.signature || lastSignature, message.seconds);
      sendResponse({ ok: true });
    }
    if (message?.type === 'SET_ALARM_MUTED') {
      config.alarmMuted = Boolean(message.muted);
      if (config.alarmMuted) stopAlarm();
      else if (lastSignature && !reminderPaused) startAlarm(lastSignature);
      sendResponse({ ok: true });
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.config) return;
    const wasMuted = config.alarmMuted;
    config = { ...defaults, ...changes.config.newValue };
    stopAlarm();
    if (wasMuted && !config.alarmMuted && lastSignature && !reminderPaused) startAlarm(lastSignature);
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = null;
    scan();
  });

  chrome.storage.sync.get({ config: defaults }, ({ config: saved }) => {
    config = { ...defaults, ...saved };
    renderPanel(); scan();
    scanTimer = setInterval(scan, 2500);
  });
})();
