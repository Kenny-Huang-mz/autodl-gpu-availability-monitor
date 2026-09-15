(() => {
  if (globalThis.__autodlGlobalAlertLoaded) return;
  globalThis.__autodlGlobalAlertLoaded = true;

  const HOST_ID = 'autodl-global-alert-host';
  const CSS = `
    :host{all:initial;position:fixed!important;top:16px!important;right:16px!important;bottom:auto!important;left:auto!important;z-index:2147483647!important;width:min(390px,calc(100vw - 32px))!important;height:auto!important;margin:0!important;padding:0!important;transform:none!important;overflow:visible!important;pointer-events:none!important;contain:layout style!important;color-scheme:light!important}
    *,*::before,*::after{box-sizing:border-box}
    .card{position:relative;width:100%;margin:0;padding:18px;border:1px solid rgba(16,90,48,.18);border-radius:14px;background:#fff;color:#17221b;box-shadow:0 14px 42px rgba(0,0,0,.24);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:auto;overflow:visible;animation:slide-in .28s ease-out}
    .main{display:flex;align-items:center;gap:13px;padding-right:26px}.icon{display:grid;place-items:center;flex:0 0 42px;height:42px;border-radius:50%;background:#178a45;color:#fff;font-size:24px;font-weight:800}
    h2{display:block;margin:0 0 3px;padding:0;border:0;color:#17221b;font:700 19px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:left}.names{display:block;margin:0;padding:0;color:#176b3b;font:700 14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:left;overflow-wrap:anywhere}.hint{display:block;margin:13px 0 0;padding:0;color:#68706b;font:400 13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:left}
    button{appearance:none;box-sizing:border-box;margin:0;text-transform:none;letter-spacing:normal}.close{position:absolute;top:10px;right:10px;width:28px;height:28px;padding:0;border:0;border-radius:50%;background:transparent;color:#778079;cursor:pointer;font:22px/28px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.close:hover{background:#edf2ee}
    .status{display:none;margin:10px 0 0;padding:7px 9px;border-radius:7px;background:#f0f7f3;color:#31704d;font:600 12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.status.visible{display:block}.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.actions button{display:grid;place-items:center;position:static;width:36px;height:36px;padding:0;border:1px solid #bbc4be;border-radius:9px;background:#fff;color:#38413b;cursor:pointer}.actions button:hover{background:#f2f5f3}.actions button.primary{border-color:#178a45;background:#178a45;color:#fff}.actions button.primary:hover{background:#13793c}.actions svg{display:block;width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    @keyframes slide-in{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
    @media(max-width:600px){:host{top:10px!important;right:10px!important;width:calc(100vw - 20px)!important}}
  `;

  function hide() {
    document.getElementById(HOST_ID)?.remove();
  }

  function show(alert) {
    hide();
    const host = document.createElement('div');
    host.id = HOST_ID;
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;
    const card = document.createElement('section');
    card.className = 'card';
    card.setAttribute('role', 'alert');
    card.innerHTML = `
      <button type="button" class="close" data-action="close" aria-label="暂时关闭提醒">×</button>
      <div class="main"><div class="icon">✓</div><div><h2>GPU 已经空出来了</h2><p class="names"></p></div></div>
      <p class="hint">AutoDL 页面可以继续留在后台，赶快回去开机吧。</p>
      <p class="status"></p>
      <div class="actions">
        <button type="button" data-action="mute"><span class="icon-slot"></span></button>
        <button type="button" class="primary" data-action="open" title="返回 AutoDL" aria-label="返回 AutoDL">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v4"/></svg>
        </button>
      </div>`;
    card.querySelector('.names').textContent = alert?.names?.length ? alert.names.join('、') : '监控实例已有可用 GPU';
    card.querySelector('[data-action="close"]').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'CLOSE_GLOBAL_ALERT' }));
    card.querySelector('[data-action="mute"]').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'TOGGLE_GLOBAL_MUTE' }));
    card.querySelector('[data-action="open"]').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'OPEN_AUTODL' }));
    root.append(style, card);
    (document.documentElement || document.body).appendChild(host);

    const status = card.querySelector('.status');
    const mute = card.querySelector('[data-action="mute"]');
    const renderMuteButton = (muted) => {
      mute.title = muted ? '恢复声音' : '停止声音';
      mute.setAttribute('aria-label', muted ? '恢复声音' : '停止声音');
      mute.querySelector('.icon-slot').innerHTML = muted
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m19 9-6 6"/><path d="m13 9 6 6"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9.5a4 4 0 0 1 0 5"/><path d="M18 7a7 7 0 0 1 0 10"/></svg>';
    };
    renderMuteButton(Boolean(alert?.muted));
    status.textContent = alert?.muted ? '当前已静音；关闭弹窗后仍会按刷新间隔再次显示' : '声音已开启；关闭弹窗后仍会按刷新间隔再次显示';
    status.classList.add('visible');
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'SHOW_GLOBAL_ALERT') show(message.alert);
    if (message?.type === 'HIDE_GLOBAL_ALERT') hide();
  });

  chrome.runtime.sendMessage({ type: 'GET_ACTIVE_ALERT' }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response?.alert) show(response.alert);
  });
})();
