let context;

const patterns = {
  classic: [
    { at: 0, frequency: 880, duration: 1.1, type: 'sine', gain: 0.16 }
  ],
  double: [
    { at: 0, frequency: 784, duration: 0.24, type: 'sine', gain: 0.17 },
    { at: 0.34, frequency: 1046, duration: 0.34, type: 'sine', gain: 0.17 }
  ],
  digital: [
    { at: 0, frequency: 660, duration: 0.16, type: 'square', gain: 0.09 },
    { at: 0.2, frequency: 880, duration: 0.16, type: 'square', gain: 0.09 },
    { at: 0.4, frequency: 1100, duration: 0.28, type: 'square', gain: 0.09 }
  ],
  gentle: [
    { at: 0, frequency: 523, duration: 0.55, type: 'sine', gain: 0.11 },
    { at: 0.22, frequency: 659, duration: 0.7, type: 'sine', gain: 0.09 },
    { at: 0.44, frequency: 784, duration: 0.85, type: 'sine', gain: 0.07 }
  ],
  urgent: [
    { at: 0, frequency: 1150, duration: 0.13, type: 'sawtooth', gain: 0.09 },
    { at: 0.18, frequency: 1150, duration: 0.13, type: 'sawtooth', gain: 0.09 },
    { at: 0.36, frequency: 1150, duration: 0.13, type: 'sawtooth', gain: 0.09 },
    { at: 0.54, frequency: 920, duration: 0.3, type: 'sawtooth', gain: 0.09 }
  ]
};

function scheduleNote(note) {
  const start = context.currentTime + note.at;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = note.type;
  oscillator.frequency.setValueAtTime(note.frequency, start);
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.exponentialRampToValueAtTime(note.gain, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, start + note.duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + note.duration + 0.02);
}

async function playTone(sound = 'classic') {
  const AudioContext = self.AudioContext || self.webkitAudioContext;
  context ||= new AudioContext();
  if (context.state === 'suspended') await context.resume();
  (patterns[sound] || patterns.classic).forEach(scheduleNote);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'OFFSCREEN_PLAY_TONE') {
    playTone(message.sound).catch((error) => console.warn('Alarm playback failed:', error));
  }
});
