(() => {
  'use strict';

  const defaults = { enabled: true, targets: [], refreshSeconds: 60, alarmMode: 'continuous', alarmSeconds: 15 };
  let config = { ...defaults };
  let lastSignature = '';
  let dismissedSignature = '';
  let alarmTimer = null;
  let reloadTimer = null;
  let scanTimer = null;
  let latestRows = [];
  let logs = [];

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

  function diagnose() {
    const results = [];
    for (const target of config.targets) {
      const row = findInstanceRow(target);
      if (!row) results.push({ target, found: false, available: false, status: '未识别到实例行' });
      else {
        const raw = row.innerText || '';
        results.push({
          target, found: true, available: normalize(raw).includes(normalize('GPU充足')),
          status: (raw.match(/已关机|运行中|开机中|关机中/) || ['状态未知'])[0],
          preview: raw.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 7).join(' / ')
        });
      }
    }
    latestRows = results;
    chrome.storage.local.set({ latestDiagnostic: results, lastCheckedAt: Date.now() });
    return results;
  }

  function playTone() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + 1.1);
      osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 1.1);
    } catch (error) { addLog(`声音播放失败：${error.message}`); }
  }

  function stopAlarm() {
    if (alarmTimer) clearInterval(alarmTimer);
    alarmTimer = null;
  }

  function startAlarm(signature) {
    if (dismissedSignature === signature) return;
    stopAlarm(); playTone();
    if (config.alarmMode === 'continuous') alarmTimer = setInterval(playTone, Math.max(5, config.alarmSeconds) * 1000);
  }

  function showBanner(available, signature) {
    document.getElementById('agm-banner')?.remove();
    const banner = document.createElement('div'); banner.id = 'agm-banner';
    const names = available.map((x) => x.target).join('、');
    banner.append(document.createTextNode(`✅ GPU 充足：${names}`));
    const button = document.createElement('button'); button.textContent = dismissedSignature === signature ? '声音已停止' : '停止声音';
    button.disabled = dismissedSignature === signature;
    button.onclick = () => { dismissedSignature = signature; stopAlarm(); button.textContent = '声音已停止'; button.disabled = true; };
    banner.append(button); document.body.appendChild(banner);
  }

  function scheduleReload() {
    if (!config.enabled || reloadTimer) return;
    const base = Math.max(30, config.refreshSeconds) * 1000;
    const jitter = Math.round(base * (Math.random() * .2 - .1));
    reloadTimer = setTimeout(() => location.reload(), base + jitter);
  }

  function scan() {
    if (!config.enabled || config.targets.length === 0) { renderPanel(); return; }
    const rows = diagnose();
    const available = rows.filter((x) => x.available);
    const signature = available.map((x) => x.target).sort().join('|');

    if (signature) {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = null; showBanner(available, signature);
      if (signature !== lastSignature) {
        dismissedSignature = '';
        startAlarm(signature);
        chrome.runtime.sendMessage({ type: 'GPU_AVAILABLE', summary: available.map((x) => x.preview).join('\n') });
        addLog(`发现 GPU 充足：${available.map((x) => x.target).join('、')}`);
      }
    } else {
      document.getElementById('agm-banner')?.remove(); stopAlarm();
      if (lastSignature) { dismissedSignature = ''; addLog('GPU 已不再充足，下一次释放将重新提醒'); }
      scheduleReload();
    }
    lastSignature = signature; renderPanel();
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
    const health = !config.enabled ? ['已暂停', 'agm-warn'] : config.targets.length === 0 ? ['尚未设置实例', 'agm-warn'] : found < config.targets.length ? [`识别异常 ${found}/${config.targets.length}`, 'agm-bad'] : ['运行正常', 'agm-ok'];
    panel.querySelector('.agm-body').innerHTML = `
      <div class="agm-row"><span>状态</span><span class="agm-value ${health[1]}">${health[0]}</span></div>
      <div class="agm-row"><span>监控目标</span><span class="agm-value">${config.targets.join('、') || '无'}</span></div>
      <div class="agm-row"><span>GPU 充足</span><span class="agm-value agm-ok">${available.join('、') || '无'}</span></div>
      <div class="agm-row"><span>最近检查</span><span class="agm-value">${stamp()}</span></div>
      <div class="agm-row"><span>提醒</span><span class="agm-value">${config.alarmMode === 'continuous' ? `每 ${config.alarmSeconds} 秒响铃` : '仅响一次'}</span></div>
      <div class="agm-actions"><button data-agm="scan">立即检测</button><button data-agm="test">测试响铃</button><button data-agm="diagnose">复制诊断</button></div>
      <div class="agm-log">${logs.join('\n') || '等待检测…'}</div>`;
    panel.querySelector('[data-agm="scan"]').onclick = scan;
    panel.querySelector('[data-agm="test"]').onclick = playTone;
    panel.querySelector('[data-agm="diagnose"]').onclick = async () => {
      const report = JSON.stringify({ url: location.href, time: new Date().toISOString(), targets: config.targets, rows: latestRows }, null, 2);
      await navigator.clipboard.writeText(report); addLog('诊断信息已复制');
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'SCAN') { scan(); sendResponse({ ok: true }); }
    if (message?.type === 'TEST_SOUND') { playTone(); sendResponse({ ok: true }); }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.config) return;
    config = { ...defaults, ...changes.config.newValue };
    dismissedSignature = ''; stopAlarm();
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
