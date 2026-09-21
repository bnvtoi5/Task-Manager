// Voice and Speech utilities for Mascot AI Voice Conversation
import { MascotAISettings } from './mascotAITypes';

// Extend window interface for webkitSpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface VoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  isVietnamese: boolean;
  isEnglish: boolean;
  default: boolean;
}

export function isSpeechRecognitionAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

// Retrieve and sort available voices
export function loadVoices(): Promise<VoiceOption[]> {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisAvailable()) {
      resolve([]);
      return;
    }

    const synth = window.speechSynthesis;
    const fetch = () => {
      const rawVoices = synth.getVoices() || [];
      const mapped: VoiceOption[] = rawVoices.map((v) => {
        const langLower = (v.lang || '').toLowerCase();
        const nameLower = (v.name || '').toLowerCase();
        const isVi =
          langLower.startsWith('vi') ||
          nameLower.includes('viet') ||
          nameLower.includes('hoaimy') ||
          nameLower.includes('nam') ||
          nameLower.includes('linh') ||
          nameLower.includes('an');
        const isEn = langLower.startsWith('en');
        return {
          voiceURI: v.voiceURI,
          name: v.name,
          lang: v.lang,
          isVietnamese: isVi,
          isEnglish: isEn,
          default: v.default,
        };
      });

      // Sort: Vietnamese voices first, then English, then alphabetical
      mapped.sort((a, b) => {
        if (a.isVietnamese && !b.isVietnamese) return -1;
        if (!a.isVietnamese && b.isVietnamese) return 1;
        if (a.isEnglish && !b.isEnglish) return -1;
        if (!a.isEnglish && b.isEnglish) return 1;
        return a.name.localeCompare(b.name);
      });

      resolve(mapped);
    };

    const initial = synth.getVoices();
    if (initial && initial.length > 0) {
      fetch();
    } else {
      synth.onvoiceschanged = fetch;
      setTimeout(fetch, 600);
    }
  });
}

// Detect language (Vietnamese vs English)
export function detectLanguage(text: string, userPreference?: 'vi' | 'en' | 'auto'): 'vi' | 'en' {
  if (userPreference === 'vi') return 'vi';
  if (userPreference === 'en') return 'en';

  if (!text) return 'vi';

  // Check for Vietnamese diacritics
  const viDiacriticsRegex = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;
  if (viDiacriticsRegex.test(text)) {
    return 'vi';
  }

  // Common Vietnamese words without accents
  const commonViWords = /\b(toi|ban|chung ta|cong viec|nhiem vu|thoi gian|bao thuc|hay|lam|duoc|khong|co|va|hoac|voi|trong|cho|cam on|xin chao)\b/i;
  if (commonViWords.test(text)) {
    return 'vi';
  }

  // Count English words
  const enWords = /\b(the|is|are|you|your|hello|hi|task|workspace|project|create|delete|update|time|please|thank|thanks)\b/i;
  if (enWords.test(text)) {
    return 'en';
  }

  return 'vi';
}

// Clean text for natural speech (remove markdown symbols, URLs, proposals JSON)
export function cleanTextForSpeech(text: string): string {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`([^`]+)`/g, '$1') // Remove inline backticks
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Replace markdown links with text
    .replace(/[#*_~>]/g, '') // Remove markdown formatting characters
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

// Global reference to currently playing audio element so it can be stopped immediately
let currentAudio: HTMLAudioElement | null = null;
let isSpeakingCancelled = false;

// Stop any currently playing speech (both Cloud Audio and Web Speech)
export function stopSpeaking(): void {
  isSpeakingCancelled = true;
  if (currentAudio) {
    // CRITICAL: Clear event listeners before pausing or resetting src,
    // otherwise setting src = '' fires audio.onerror which mistakenly triggers fallback speech in the other language!
    currentAudio.onerror = null;
    currentAudio.onended = null;
    currentAudio.onplay = null;
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio.src = '';
    } catch (e) {}
    currentAudio = null;
  }
  if (isSpeechSynthesisAvailable()) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
}

// Speak a text string using either Cloud TTS (100% natural Vietnamese/English) or Browser Web Speech
export function speakText(
  text: string,
  settings: Partial<MascotAISettings>,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }
): () => void {
  // Always stop previous speech first
  stopSpeaking();
  isSpeakingCancelled = false;

  const clean = cleanTextForSpeech(text);
  if (!clean) {
    callbacks?.onEnd?.();
    return () => {};
  }

  const targetLang = detectLanguage(clean, settings.voiceLanguage || 'vi');
  const engine = settings.voiceEngine || 'cloud';

  // Helper for Browser Web Speech
  const playViaBrowser = () => {
    if (isSpeakingCancelled) return () => {};

    if (!isSpeechSynthesisAvailable()) {
      callbacks?.onError?.('Trình duyệt không hỗ trợ Web Speech API.');
      return () => {};
    }

    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = Math.max(0.7, Math.min(1.6, settings.voiceRate || 1.0));
    utterance.pitch = Math.max(0.8, Math.min(1.4, settings.voicePitch || 1.0));

    const allVoices = synth.getVoices() || [];
    let matchedVoice: SpeechSynthesisVoice | undefined;

    // 1. Explicit voiceURI match
    if (settings.voiceURI) {
      matchedVoice = allVoices.find((v) => v.voiceURI === settings.voiceURI);
    }

    // 2. Language-specific match
    if (!matchedVoice) {
      if (targetLang === 'vi') {
        matchedVoice = allVoices.find(
          (v) =>
            (v.lang || '').toLowerCase().startsWith('vi') ||
            (v.name || '').toLowerCase().includes('viet') ||
            (v.name || '').toLowerCase().includes('hoaimy')
        );
      } else {
        matchedVoice = allVoices.find((v) => (v.lang || '').toLowerCase().startsWith('en'));
      }
    }

    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onstart = () => {
      if (!isSpeakingCancelled) callbacks?.onStart?.();
    };
    utterance.onend = () => {
      if (!isSpeakingCancelled) callbacks?.onEnd?.();
    };
    utterance.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled' || isSpeakingCancelled) {
        callbacks?.onEnd?.();
        return;
      }
      callbacks?.onError?.(e);
    };

    synth.speak(utterance);
    return () => {
      try {
        synth.cancel();
      } catch (e) {}
    };
  };

  // Helper for Cloud TTS
  const playViaCloud = () => {
    if (isSpeakingCancelled) return () => {};

    try {
      const audioUrl = `/api/mascot/tts?text=${encodeURIComponent(clean)}&lang=${targetLang}`;
      const audio = new Audio(audioUrl);
      currentAudio = audio;

      audio.playbackRate = Math.max(0.7, Math.min(1.6, settings.voiceRate || 1.0));
      audio.volume = Math.max(0.1, Math.min(1.0, settings.voiceVolume ?? 1.0));

      audio.onplay = () => {
        if (!isSpeakingCancelled) {
          callbacks?.onStart?.();
        }
      };

      audio.onended = () => {
        if (currentAudio === audio) {
          currentAudio = null;
        }
        if (!isSpeakingCancelled) {
          callbacks?.onEnd?.();
        }
      };

      audio.onerror = () => {
        // If speech was cancelled by user, DO NOT trigger browser fallback speech!
        if (isSpeakingCancelled || currentAudio !== audio) {
          return;
        }
        currentAudio = null;
        console.warn('Cloud TTS endpoint error, falling back to Browser Web Speech');
        playViaBrowser();
      };

      audio.play().catch((err) => {
        // Auto-play might be blocked or cancelled by user
        if (isSpeakingCancelled || currentAudio !== audio) {
          return;
        }
        console.warn('Audio play rejected or interrupted:', err);
        currentAudio = null;
        callbacks?.onEnd?.();
      });

      return () => {
        audio.onerror = null;
        audio.onended = null;
        audio.onplay = null;
        if (currentAudio === audio) {
          try {
            audio.pause();
            audio.currentTime = 0;
            audio.src = '';
          } catch (e) {}
          currentAudio = null;
        }
        callbacks?.onEnd?.();
      };
    } catch (err) {
      if (isSpeakingCancelled) return () => {};
      return playViaBrowser();
    }
  };

  // If engine is 'cloud', use Cloud TTS (or fallback if necessary)
  if (engine === 'cloud') {
    return playViaCloud();
  }

  // If engine is 'browser', check if browser actually has a voice for targetLang (especially Vietnamese)
  if (isSpeechSynthesisAvailable()) {
    const allVoices = window.speechSynthesis.getVoices() || [];
    const hasViVoice = allVoices.some(
      (v) =>
        (v.lang || '').toLowerCase().startsWith('vi') ||
        (v.name || '').toLowerCase().includes('viet') ||
        (v.name || '').toLowerCase().includes('hoaimy')
    );

    // If target is Vietnamese but browser lacks Vietnamese voice, automatically use Cloud TTS so it sounds Vietnamese
    if (targetLang === 'vi' && !hasViVoice && !settings.voiceURI) {
      return playViaCloud();
    }
  }

  return playViaBrowser();
}

// Speech Recognition instance wrapper
export interface SpeechRecognitionController {
  start: () => void;
  stop: () => void;
  abort: () => void;
  resetTranscript: () => void;
}

export interface CreateSpeechRecognizerOptions {
  onResult: (transcript: string, isFinal: boolean) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (errorMessage: string) => void;
  lang?: string;
  languagePreference?: 'vi' | 'en' | 'auto';
  continuous?: boolean;
  silenceTimeoutMs?: number; // Defaults to 3500ms grace period after user stops speaking
  autoRestart?: boolean;
}

export function createSpeechRecognizer(
  options: CreateSpeechRecognizerOptions
): SpeechRecognitionController | null {
  if (!isSpeechRecognitionAvailable()) {
    options.onError?.('Trình duyệt chưa hỗ trợ nhận diện giọng nói (Web Speech API).');
    return null;
  }

  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognizer: any = null;
  let isListeningActive = false;
  let isExplicitlyStopped = false;
  let silenceTimer: any = null;
  let accumulatedFinal = '';

  const targetLang = options.lang
    ? options.lang
    : options.languagePreference === 'en'
    ? 'en-US'
    : 'vi-VN';

  const clearSilenceTimer = () => {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  };

  const resetSilenceTimer = () => {
    clearSilenceTimer();
    const timeout = options.silenceTimeoutMs !== undefined ? options.silenceTimeoutMs : 3500;
    if (timeout > 0 && isListeningActive) {
      silenceTimer = setTimeout(() => {
        // User has been silent for the grace period
        if (isListeningActive && !isExplicitlyStopped) {
          const finalOutput = accumulatedFinal.trim();
          if (finalOutput) {
            options.onResult(finalOutput, true);
          }
          try {
            recognizer?.stop();
          } catch (e) {}
        }
      }, timeout);
    }
  };

  const setupRecognizer = () => {
    recognizer = new SpeechRecognitionClass();
    recognizer.lang = targetLang;
    // Set continuous to true so short pauses (breathing, thinking) do NOT stop recognition prematurely
    recognizer.continuous = options.continuous !== undefined ? options.continuous : true;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 1;

    recognizer.onstart = () => {
      isListeningActive = true;
      options.onStart?.();
      resetSilenceTimer();
    };

    recognizer.onresult = (event: any) => {
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        const trans = item[0]?.transcript || '';
        if (item.isFinal) {
          accumulatedFinal += trans + ' ';
        } else {
          currentInterim += trans;
        }
      }

      const combined = (accumulatedFinal + currentInterim).trim();
      if (combined) {
        options.onResult(combined, false);
      }

      // Reset silence grace timer whenever user speaks
      resetSilenceTimer();
    };

    recognizer.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        // User didn't speak yet; keep listening if continuous
        resetSilenceTimer();
        return;
      }
      if (event.error === 'aborted') {
        return;
      }
      let msg = 'Lỗi nhận diện âm thanh: ' + (event.error || 'không xác định');
      if (event.error === 'not-allowed') {
        msg = 'Quyền truy cập Micro bị từ chối trên trình duyệt. Vui lòng cấp quyền Micro.';
      }
      options.onError?.(msg);
    };

    recognizer.onend = () => {
      clearSilenceTimer();
      isListeningActive = false;

      // If continuous mode was running and user did not explicitly stop, auto-restart unless errored
      if (!isExplicitlyStopped && options.autoRestart) {
        try {
          recognizer.start();
          return;
        } catch (e) {}
      }

      const finalOutput = accumulatedFinal.trim();
      if (finalOutput) {
        options.onResult(finalOutput, true);
      }
      options.onEnd?.();
    };
  };

  setupRecognizer();

  return {
    start: () => {
      isExplicitlyStopped = false;
      clearSilenceTimer();
      try {
        recognizer.start();
      } catch (e) {
        // In case previous instance was in closing state
        try {
          setupRecognizer();
          recognizer.start();
        } catch (err) {}
      }
    },
    stop: () => {
      isExplicitlyStopped = true;
      clearSilenceTimer();
      isListeningActive = false;
      try {
        recognizer.stop();
      } catch (e) {}
    },
    abort: () => {
      isExplicitlyStopped = true;
      clearSilenceTimer();
      isListeningActive = false;
      accumulatedFinal = '';
      try {
        recognizer.abort();
      } catch (e) {}
    },
    resetTranscript: () => {
      accumulatedFinal = '';
      clearSilenceTimer();
    },
  };
}
