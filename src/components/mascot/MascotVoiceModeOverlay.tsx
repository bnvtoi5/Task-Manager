import React, { useEffect } from 'react';
import {
  X,
  Mic,
  MicOff,
  Square,
  Sparkles,
  Volume2,
  MessageSquare,
  Radio,
  Sliders,
  AlertCircle,
  Key,
  Check,
} from 'lucide-react';
import { MascotPersona } from './mascotPersonas';
import { MascotAISettings } from './mascotAITypes';
import { MascotSpriteAvatar } from './MascotSpriteAvatar';

interface MascotVoiceModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  activePersona: MascotPersona;
  settings: MascotAISettings;
  isLoading: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  currentTranscript: string;
  lastAiResponse?: string;
  pendingProposalQuestion?: string | null;
  onApprovePendingProposals?: () => void;
  onRejectPendingProposals?: () => void;
  onStartListening: () => void;
  onStopListening: () => void;
  onStopAll: () => void;
  onSelectLanguage?: (lang: 'vi' | 'en') => void;
  onConfirmVoiceSend?: (text: string) => void;
  onCancelVoice?: () => void;
  onOpenSettings?: () => void;
}

export const MascotVoiceModeOverlay: React.FC<MascotVoiceModeOverlayProps> = ({
  isOpen,
  onClose,
  activePersona,
  settings,
  isLoading,
  isSpeaking,
  isListening,
  currentTranscript,
  lastAiResponse,
  pendingProposalQuestion,
  onApprovePendingProposals,
  onRejectPendingProposals,
  onStartListening,
  onStopListening,
  onStopAll,
  onSelectLanguage,
  onConfirmVoiceSend: _onConfirmVoiceSend,
  onCancelVoice: _onCancelVoice,
  onOpenSettings,
}) => {
  // Auto-start listening on mount when entering Voice Mode
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (!isListening && !isSpeaking && !isLoading) {
        onStartListening();
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  // Determine current active status
  let statusText = 'Sẵn sàng - Chạm vào vòng tròn để nói';
  let orbColor = 'from-amber-400 via-orange-500 to-amber-600';
  let glowColor = 'rgba(245, 158, 11, 0.4)';
  let isPulsing = false;

  if (pendingProposalQuestion) {
    statusText = isListening ? 'Đang nghe... Hãy nói "OK" hoặc "Không"' : '❓ Xin hãy xác nhận: OK hoặc Không?';
    orbColor = 'from-amber-400 via-rose-500 to-amber-600';
    glowColor = 'rgba(245, 158, 11, 0.6)';
    isPulsing = true;
  } else if (isListening) {
    statusText = 'Đang lắng nghe bạn nói...';
    orbColor = 'from-rose-500 via-amber-500 to-orange-500';
    glowColor = 'rgba(239, 68, 68, 0.5)';
    isPulsing = true;
  } else if (isLoading) {
    statusText = `${activePersona.name} đang suy nghĩ...`;
    orbColor = 'from-indigo-500 via-purple-500 to-pink-500';
    glowColor = 'rgba(168, 85, 247, 0.5)';
    isPulsing = true;
  } else if (isSpeaking) {
    statusText = `${activePersona.name} đang trả lời...`;
    orbColor = 'from-emerald-400 via-teal-500 to-cyan-500';
    glowColor = 'rgba(168, 85, 247, 0.5)';
    isPulsing = true;
  }

  const hasApiKey = Boolean(settings.apiKey && settings.apiKey.trim());
  const displayModel =
    settings.model === 'custom'
      ? settings.customModelName || 'Custom'
      : settings.model;
  const isApiKeyIssue =
    lastAiResponse?.includes('API Key') ||
    lastAiResponse?.includes('Chưa kết nối được API');

  return (
    <div className="absolute inset-0 z-40 bg-slate-950/95 backdrop-blur-xl text-white flex flex-col items-center justify-between p-6 animate-in fade-in zoom-in-95 duration-200 select-none">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-base">
            {activePersona.emoji}
          </div>
          <div>
            <h4 className="font-bold text-sm tracking-wide flex items-center gap-1.5 flex-wrap">
              <span>{activePersona.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                Voice Mode
              </span>
              <span
                className={`text-[9px] px-2 py-0.5 rounded-full border flex items-center gap-1 font-mono ${
                  hasApiKey
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                }`}
                title={hasApiKey ? 'Đã kết nối API Key' : 'Chưa nhập API Key cá nhân'}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${hasApiKey ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                <span>{(settings.provider || 'gemini').toUpperCase()}</span>
                <span>•</span>
                <span className="truncate max-w-[110px]">{displayModel}</span>
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">{activePersona.tagline}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onSelectLanguage && (
            <div className="flex items-center bg-white/10 rounded-xl p-0.5 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => onSelectLanguage('vi')}
                className={`px-2 py-1 rounded-lg font-bold transition text-[11px] flex items-center gap-1 cursor-pointer ${
                  settings.voiceLanguage !== 'en'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Đàm thoại bằng Tiếng Việt"
              >
                <span>🇻🇳</span>
                <span className="hidden sm:inline">Việt</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectLanguage('en')}
                className={`px-2 py-1 rounded-lg font-bold transition text-[11px] flex items-center gap-1 cursor-pointer ${
                  settings.voiceLanguage === 'en'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Đàm thoại bằng English"
              >
                <span>🇬🇧</span>
                <span className="hidden sm:inline">English</span>
              </button>
            </div>
          )}

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-amber-300 transition active:scale-95 cursor-pointer"
              title="Cài đặt API Key & Nhà cung cấp AI"
            >
              <Sliders className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 transition active:scale-95 cursor-pointer"
            title="Quay lại giao diện chat chữ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Center Interactive Voice Orb */}
      <div className="flex flex-col items-center justify-center my-auto text-center space-y-8 max-w-sm w-full">
        {/* Animated Sound Orb */}
        <div className="relative flex items-center justify-center">
          {/* Outer Ripple Rings */}
          {isPulsing && (
            <>
              <div
                className="absolute w-56 h-56 rounded-full animate-ping opacity-25"
                style={{ backgroundColor: glowColor, animationDuration: '3s' }}
              />
              <div
                className="absolute w-44 h-44 rounded-full animate-pulse opacity-40"
                style={{ backgroundColor: glowColor, animationDuration: '1.8s' }}
              />
            </>
          )}

          {/* Main Orb Button */}
          <button
            type="button"
            onClick={() => {
              if (isLoading || isSpeaking) {
                onStopAll();
              } else if (isListening) {
                onStopListening();
              } else {
                onStartListening();
              }
            }}
            className={`relative z-10 w-36 h-36 rounded-full bg-gradient-to-tr ${orbColor} shadow-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 transform active:scale-90 hover:scale-105`}
            style={{
              boxShadow: `0 0 50px ${glowColor}`,
            }}
          >
            <div className="mb-2">
              <MascotSpriteAvatar
                persona={activePersona}
                size={76}
                interactive={false}
              />
            </div>
            <div className="absolute bottom-2">
              {isListening ? (
                <Radio className="w-4 h-4 text-white animate-pulse" />
              ) : isSpeaking ? (
                <Volume2 className="w-4 h-4 text-white animate-bounce" />
              ) : isLoading ? (
                <Sparkles className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Mic className="w-4 h-4 text-white/90" />
              )}
            </div>
          </button>
        </div>

        {/* Dynamic Status Text */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
            {statusText}
          </p>

          {/* Live Transcript or AI Text */}
          <div className="min-h-[56px] flex flex-col items-center justify-center px-4 w-full">
            {pendingProposalQuestion ? (
              <div className="w-full max-w-sm p-4 rounded-2xl bg-amber-500/15 border border-amber-400/50 backdrop-blur-md shadow-2xl text-center space-y-2.5 animate-in fade-in zoom-in-95">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-bold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" />
                  <span>Xác nhận hành động</span>
                </span>
                <p className="text-xs font-semibold text-white leading-relaxed">
                  {pendingProposalQuestion}
                </p>
                {isListening && (
                  <p className="text-[11px] text-amber-300/90 italic animate-pulse">
                    🎙️ Đang nghe... Hãy nói &ldquo;OK&rdquo; hoặc &ldquo;Không&rdquo;
                  </p>
                )}
                <div className="flex items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={onApprovePendingProposals}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>OK</span>
                  </button>
                  <button
                    type="button"
                    onClick={onRejectPendingProposals}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-rose-500/20 hover:text-rose-200 text-slate-300 font-semibold text-xs transition active:scale-95 cursor-pointer"
                  >
                    Không
                  </button>
                </div>
              </div>
            ) : isListening ? (
              <p className="text-sm font-medium text-slate-200 italic animate-pulse">
                &ldquo;{currentTranscript || 'Đang nghe bạn...'}&rdquo;
              </p>
            ) : isLoading ? (
              <p className="text-sm font-medium text-amber-300 animate-pulse flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                <span>{activePersona.name} đang xử lý yêu cầu...</span>
              </p>
            ) : isSpeaking && lastAiResponse ? (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                  {lastAiResponse}
                </p>
                {isApiKeyIssue && onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold transition active:scale-95 cursor-pointer"
                  >
                    <Key className="w-3 h-3" />
                    <span>Mở Cài đặt API Key</span>
                  </button>
                )}
              </div>
            ) : isApiKeyIssue && onOpenSettings ? (
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-400/40 max-w-xs space-y-2 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-300">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>Cần cấu hình API Key</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-tight">
                  Nhà cung cấp {settings.provider.toUpperCase()} chưa có khóa API hợp lệ.
                </p>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition active:scale-95 cursor-pointer"
                >
                  Cài đặt ngay
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                {settings.continuousVoiceMode
                  ? 'Chế độ trò chuyện liên tục: Bấm vào quả cầu hoặc micro để nói bất cứ lúc nào.'
                  : 'Bấm micro hoặc biểu tượng giữa màn hình để bắt đầu nói.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="w-full max-w-sm flex items-center justify-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-md">
        {/* Toggle Listening Button */}
        <button
          type="button"
          onClick={() => {
            if (isListening) onStopListening();
            else onStartListening();
          }}
          className={`p-3.5 rounded-2xl transition active:scale-95 flex items-center justify-center cursor-pointer ${
            isListening
              ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/50'
              : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
          title={isListening ? 'Dừng lắng nghe' : 'Bật Micro để nói'}
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* STOP BUTTON - Icon Only as requested by user */}
        {(isLoading || isSpeaking) && (
          <button
            type="button"
            onClick={onStopAll}
            className="p-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/50 active:scale-95 transition flex items-center justify-center shrink-0 cursor-pointer"
            title="Dừng ngay lập tức"
            aria-label="Dừng"
          >
            <Square className="w-5 h-5 fill-current" />
          </button>
        )}

        {/* Settings button in voice mode */}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition active:scale-95 flex items-center justify-center cursor-pointer"
            title="Mở Cài đặt API & Mascot"
          >
            <Sliders className="w-5 h-5" />
          </button>
        )}

        {/* Switch back to text chat */}
        <button
          type="button"
          onClick={onClose}
          className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition active:scale-95 flex items-center justify-center cursor-pointer"
          title="Chuyển sang gõ văn bản"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
