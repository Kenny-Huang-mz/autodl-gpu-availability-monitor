const defaults = { enabled: true, targets: [], refreshSeconds: 60, alarmMode: 'continuous', alarmSeconds: 15, alarmSound: 'classic', alarmMuted: false };
const $ = (id) => document.getElementById(id);
let savedMuted = false;

chrome.storage.sync.get({ config: defaults }, ({ config }) => {
  const value = { ...defaults, ...config };
  savedMuted = value.alarmMuted;
  $('enabled').checked = value.enabled; $('targets').value = value.targets.join(', ');
  $('refresh').value = value.refreshSeconds; $('mode').value = value.alarmMode; $('alarm').value = value.alarmSeconds; $('sound').value = value.alarmSound;
});

chrome.storage.local.get(['latestDiagnostic', 'lastCheckedAt'], ({ latestDiagnostic = [], lastCheckedAt }) => {
  $('diagnostic').textContent = latestDiagnostic.length
    ? latestDiagnostic.map((x) => `${x.found ? (x.available ? '✅' : x.availability === 'unknown' ? '⚠️' : '○') : '⚠️'} ${x.target}：${x.status}${x.source ? `（${x.source}）` : ''}`).join('\n')
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
    alarmSeconds: Math.max(5, Number($('alarm').value) || 15),
    alarmSound: $('sound').value,
    alarmMuted: savedMuted
  };
  chrome.storage.sync.set({ config }, () => window.close());
};
$('test').onclick = () => chrome.runtime.sendMessage({ type: 'TEST_GLOBAL_ALERT' });
$('preview').onclick = () => chrome.runtime.sendMessage({ type: 'PLAY_ALARM', sound: $('sound').value });
