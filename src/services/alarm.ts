/**
 * Audio Synthesizer & Alarm Service
 * Generates an alarm chime using browser Web Audio API (no external MP3/WAV needed)
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a pleasant double chime (523Hz C5 -> 659Hz E5 -> 784Hz G5)
 */
export function playAlarmSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // First chime
    playTone(523.25, now, 0.4);       // C5
    playTone(659.25, now + 0.2, 0.4); // E5
    playTone(783.99, now + 0.4, 0.7); // G5

    // Second chime echo
    playTone(523.25, now + 0.9, 0.4);
    playTone(659.25, now + 1.1, 0.4);
    playTone(1046.50, now + 1.3, 0.9); // C6
  } catch (err) {
    console.warn('Web Audio playback error:', err);
  }
}

/**
 * Requests browser notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return false;
}

/**
 * Dispatches a native browser notification if allowed
 */
export function sendBrowserNotification(title: string, body: string, icon = '🔔'): void {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: 'https://api.iconify.design/lucide:bell.svg',
      });
    } catch (e) {
      console.warn('Notification error:', e);
    }
  }
}
