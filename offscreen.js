let context;

async function playTone() {
  const AudioContext = self.AudioContext || self.webkitAudioContext;
  context ||= new AudioContext();
  if (context.state === 'suspended') await context.resume();

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.16, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 1.1);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 1.1);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'OFFSCREEN_PLAY_TONE') playTone().catch((error) => console.warn('Alarm playback failed:', error));
});
