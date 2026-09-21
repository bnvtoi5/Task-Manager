import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { Mascot } from 'page-mascot';
import { MascotAIChatDrawer } from './MascotAIChatDrawer';
import { getStoredPersonas, MascotPersona } from './mascotPersonas';
import { DEFAULT_AI_SETTINGS, MascotAISettings } from './mascotAITypes';
import { getMascotSprite } from './mascotSprites';
import { MascotSpriteAvatar } from './MascotSpriteAvatar';

export function openMascotAIChat() {
  window.dispatchEvent(new CustomEvent('open_mascot_ai_chat'));
}

export interface MascotCompanionPrefs {
  visible: boolean;
  position: 'bottom-right' | 'bottom-left';
  soundEnabled: boolean;
  minimized: boolean;
}

const DEFAULT_PREFS: MascotCompanionPrefs = {
  visible: true,
  position: 'bottom-right',
  soundEnabled: true,
  minimized: false,
};

export const PageMascotCompanion: React.FC = () => {
  // 1. Preferences (visibility, minimized state)
  const [prefs, setPrefs] = useState<MascotCompanionPrefs>(() => {
    try {
      const saved = localStorage.getItem('page_mascot_companion_prefs');
      if (saved) return { ...DEFAULT_PREFS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_PREFS;
  });

  // 2. Synchronized AI Settings (personaId, etc.)
  const [aiSettings, setAiSettings] = useState<MascotAISettings>(() => {
    try {
      const saved = localStorage.getItem('page_mascot_ai_settings_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_AI_SETTINGS;
  });

  // 3. Personas list (defaults to Bunny Assistant)
  const [personas, setPersonas] = useState<MascotPersona[]>(() => getStoredPersonas());

  // 4. UI Interaction States
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isBubbleVisible, setIsBubbleVisible] = useState(true);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const bubbleTimeoutRef = useRef<number | null>(null);

  // Sync settings when localStorage or custom events change
  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = localStorage.getItem('page_mascot_ai_settings_v1');
        if (saved) setAiSettings(JSON.parse(saved));
        setPersonas(getStoredPersonas());
      } catch {}
    };
    window.addEventListener('mascot_settings_changed', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('mascot_settings_changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Save preferences
  useEffect(() => {
    try {
      localStorage.setItem('page_mascot_companion_prefs', JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

  // Listen for open_mascot_ai_chat event
  useEffect(() => {
    const handleOpenChat = () => setIsAIChatOpen(true);
    window.addEventListener('open_mascot_ai_chat', handleOpenChat);
    return () => window.removeEventListener('open_mascot_ai_chat', handleOpenChat);
  }, []);

  // Listen to toggle_page_mascot_visibility event from profile
  useEffect(() => {
    const handleToggleVis = (e: Event) => {
      const customEvent = e as CustomEvent<{ visible?: boolean }>;
      setPrefs((p) => {
        const newVis =
          customEvent.detail?.visible !== undefined
            ? customEvent.detail.visible
            : !p.visible;
        return { ...p, visible: newVis, minimized: false };
      });
    };
    window.addEventListener('toggle_page_mascot_visibility', handleToggleVis);
    return () =>
      window.removeEventListener('toggle_page_mascot_visibility', handleToggleVis);
  }, []);

  // Active persona synchronized with Mascot Chat Drawer
  const activePersona = useMemo(() => {
    const targetId = aiSettings.personaId || 'bunny';
    return (
      personas.find((p) => p.id === targetId) ||
      personas.find((p) => p.id === 'bunny') ||
      personas[0]
    );
  }, [aiSettings.personaId, personas]);

  // Get active mascot sprite configuration
  const activeSprite = useMemo(() => {
    return getMascotSprite(activePersona.defaultSpriteId || 'bunny');
  }, [activePersona.defaultSpriteId]);

  // Dynamic persona tips matching the character
  const tips = useMemo(() => {
    if (activePersona.id === 'bunny' || activePersona.defaultSpriteId === 'bunny') {
      return [
        'Cùng Thỏ hoàn thành các mục tiêu hôm nay nhé! 🐰✨',
        'Bài nào khó, bạn cứ bấm chat để cùng Thỏ tháo gỡ nhé! 💡',
        'Mỗi ngày hoàn thành 3 việc trọng tâm là bứt phá rực rỡ! 🎯',
        'Đừng quên nghỉ ngơi và uống nước sau khi học tập nhé! 🌸',
      ];
    }
    return [
      activePersona.tagline,
      'Tôi luôn ở đây đồng hành và hỗ trợ bạn trong mọi công việc! ✨',
      'Cần tạo việc mới hay hẹn giờ báo thức? Bấm vào chat để bảo tôi nhé! 🐾',
      'Hãy giữ vững sự tập trung, bạn đang làm rất tốt! 🚀',
    ];
  }, [activePersona]);

  // Cute audio chime
  const playCuteSound = useCallback(() => {
    if (!prefs.soundEnabled) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(960, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  }, [prefs.soundEnabled]);

  // Mascot Click
  const handleMascotClick = () => {
    playCuteSound();

    // Cycle tip and show bubble
    setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    setIsBubbleVisible(true);

    if (bubbleTimeoutRef.current) {
      window.clearTimeout(bubbleTimeoutRef.current);
    }
    bubbleTimeoutRef.current = window.setTimeout(() => {
      setIsBubbleVisible(false);
    }, 16000);
  };

  const handleOpenChat = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsAIChatOpen(true);
  };

  // If user disabled mascot in preferences
  if (!prefs.visible) {
    return (
      <MascotAIChatDrawer
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        mascotSpriteId={activePersona.defaultSpriteId || 'bunny'}
      />
    );
  }

  return (
    <>
      <div
        id="page-mascot-companion-widget"
        className="fixed bottom-5 right-5 z-[990] flex flex-col items-end select-none font-sans"
      >
        {/* Minimized Floating Pill Button */}
        {prefs.minimized ? (
          <button
            type="button"
            onClick={() => setPrefs((p) => ({ ...p, minimized: false }))}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 shadow-xl text-xs font-semibold text-neutral-800 dark:text-neutral-100 transition-all hover:scale-105 cursor-pointer"
            title={`Mở thú cưng ${activePersona.name}`}
          >
            <MascotSpriteAvatar persona={activePersona} size={28} interactive={false} />
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {activePersona.name}
            </span>
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          </button>
        ) : (
          <div className="flex flex-col items-end relative">
            {/* 1. Speech Bubble (Click directly in bubble to chat) */}
            {isBubbleVisible && (
              <div
                onClick={handleOpenChat}
                className="mb-2.5 w-[255px] sm:w-[280px] p-3 px-3.5 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border border-amber-300/60 dark:border-neutral-800 shadow-xl shadow-neutral-900/5 dark:shadow-black/30 text-neutral-800 dark:text-neutral-100 animate-in fade-in zoom-in-95 duration-200 relative origin-bottom-right cursor-pointer hover:border-emerald-500/80 transition group"
                title="Bấm vào bóng bóng để mở chat ngay với Mascot"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <p className="text-xs text-neutral-800 dark:text-neutral-200 font-medium leading-relaxed">
                    <span className="text-amber-500 font-bold mr-1">✨</span>
                    {tips[currentTipIndex] || tips[0]}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsBubbleVisible(false);
                    }}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5 rounded-md transition"
                    title="Đóng lời thoại"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {/* "💬 Bấm để chat ngay" Action in bubble */}
                <div className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 flex items-center gap-1.5 transition">
                  <span className="text-sm">💬</span>
                  <span className="group-hover:underline">Bấm để chat ngay</span>
                </div>

                {/* Speech Bubble Arrow */}
                <div className="absolute -bottom-2 right-14 w-0 h-0 border-l-6 border-l-transparent border-r-6 border-r-transparent border-t-6 border-t-white dark:border-t-neutral-900 drop-shadow-xs" />
              </div>
            )}

            {/* 2. Mascot Floating Transparent Container (NO BOX, 100% TRANSPARENT, NO LABEL TEXT AT BOTTOM) */}
            <div className="flex flex-col items-center relative group select-none">
              {/* Top right minimize chevron - subtle button visible on hover */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPrefs((p) => ({ ...p, minimized: true }));
                }}
                className="absolute -top-1 -right-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-5 h-5 rounded-full bg-black/40 hover:bg-black/60 dark:bg-white/30 dark:hover:bg-white/50 text-white flex items-center justify-center backdrop-blur-xs cursor-pointer shadow-xs"
                title="Thu nhỏ"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {/* Cursor-Tracking Animated Mascot (100% Transparent Background, No Box, No bottom label text) */}
              <div
                onClick={handleMascotClick}
                className="cursor-pointer transition-transform duration-200 flex items-center justify-center hover:scale-105 active:scale-95 filter drop-shadow-md"
                title={`Bấm để tương tác cùng ${activePersona.name}`}
              >
                <Mascot
                  directions={activeSprite.directions}
                  reactions={activeSprite.reactions}
                  size={120}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Fully Synchronized Mascot AI Chat Drawer & Voice Modal */}
      <MascotAIChatDrawer
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        mascotSpriteId={activePersona.defaultSpriteId || 'bunny'}
      />
    </>
  );
};
