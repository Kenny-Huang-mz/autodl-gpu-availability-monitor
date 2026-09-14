const defaults = { enabled: true, targets: [], refreshSeconds: 60, alarmMode: 'continuous', alarmSeconds: 15 };
const $ = (id) => document.getElementById(id);

function activeAutoDLTab(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => callback(tab));
}

chrome.storage.sync.get({ config: defaults }, ({ config }) => {
  const value = { ...defaults, ...config };
  $('enabled').checked = value.enabled; $('targets').value = value.targets.join(', ');
  $('refresh').value = value.refreshSeconds; $('mode').value = value.alarmMode; $('alarm').value = value.alarmSeconds;
});

chrome.storage.local.get(['latestDiagnostic', 'lastCheckedAt'], ({ latestDiagnostic = [], lastCheckedAt }) => {
  $('diagnostic').textContent = latestDiagnostic.length
    ? latestDiagnostic.map((x) => `${x.found ? (x.available ? '✅' : '○') : '⚠️'} ${x.target}：${x.found ? `${x.status}${x.available ? ' / GPU充足' : ''}` : x.status}`).join('\n')
    : '尚无诊断结果。请打开 AutoDL 容器实例页面。';
  if (lastCheckedAt) $('diagnostic').textContent += `\n检查时间：${new Date(lastCheckedAt).toLocaleTimeString()}`;
});

$('mode').onchange = () => { $('alarm').disabled = $('mode').value !== 'continuous'; };
$('save').onclick = () => {
  const config = {
    enabled: $('enabled').checked,
    targets: $('targets').value.split(/[,，\n]/).map((x) => x.trim()).filter(Boolean),
    refreshSeconds: Math.max(30, Number($('refresh').value) || 60),
    alarmMode: $('mode').value,
    alarmSeconds: Math.max(5, Number($('alarm').value) || 15)
  };
  chrome.storage.sync.set({ config }, () => window.close());
};
$('test').onclick = () => activeAutoDLTab((tab) => {
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'TEST_SOUND' }, () => {
    if (chrome.runtime.lastError) $('diagnostic').textContent = '请先打开并刷新 AutoDL 容器实例页面。';
  });
});
