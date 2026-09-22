import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Cpu,
  Sparkles,
  Volume2,
  Sliders,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Activity,
  Wifi,
  RotateCcw,
  Search,
  Bot,
  ExternalLink,
  Play,
  Square,
  ShieldCheck,
  Globe,
  Languages,
  MessageSquare,
  Zap,
  Eye,
  EyeOff,
  Info,
  Edit3,
  Plus,
} from 'lucide-react';
import { MascotAISettings, DEFAULT_AI_SETTINGS } from './mascotAITypes';
import { MascotPersona, saveStoredPersonas, resetStoredPersonas } from './mascotPersonas';
import { VoiceOption, loadVoices, speakText, stopSpeaking } from './mascotVoiceService';
import { MascotSpriteAvatar } from './MascotSpriteAvatar';
import { testMascotAPIConnection, TestConnectionResult } from './mascotAIService';

interface MascotSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: MascotAISettings;
  onSaveSettings: (newSettings: MascotAISettings) => void;
  personas: MascotPersona[];
  onUpdatePersonas: (newPersonas: MascotPersona[]) => void;
  selectedPersonaId: string;
  onSelectPersona: (id: string) => void;
  onShowToast: (msg: string) => void;
}

// Definition of 6 supported AI providers with modern Frontier & High-Availability models
const AI_PROVIDERS = [
  {
    id: 'gemini' as const,
    name: 'Google Gemini',
    icon: Sparkles,
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyLabel: 'Lấy key miễn phí',
    keyPlaceholder: 'Dán Google Gemini API Key của bạn vào đây (Bắt đầu bằng AIzaSy...)...',
    defaultModel: 'gemini-3.1-flash-lite',
    models: [
      {
        id: 'gemini-3.1-flash-lite',
        title: 'Gemini 3.1 Flash-Lite',
        desc: 'Mô hình siêu tốc với độ trễ cực thấp, cụm máy chủ công suất lớn không bao giờ bị nghẽn tải 503.',
        badge: '⚡ Siêu tốc - Chống 503',
        badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300',
      },
      {
        id: 'gemini-flash-latest',
        title: 'Gemini Flash Latest',
        desc: 'Mô hình chính thức tự động cân bằng tải qua cụm máy chủ ổn định, xử lý tác vụ toàn diện.',
        badge: '🛡️ Toàn diện',
        badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300',
      },
      {
        id: 'gemini-3.8-flash',
        title: 'Gemini 3.8 Flash',
        desc: 'Thế hệ 3.8 Flash mới nhất với năng lực suy luận ngôn ngữ nâng cao.',
        badge: '🔥 Mới nhất',
        badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300',
      },
      {
        id: 'gemini-3.5-flash',
        title: 'Gemini 3.5 Flash',
        desc: 'Bản phát hành chuẩn xác cao, cân bằng tối ưu giữa hiệu năng và độ ổn định.',
        badge: '⚖️ Ổn định',
        badgeColor: 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300',
      },
      {
        id: 'gemini-3.1-pro-preview',
        title: 'Gemini 3.1 Pro Preview',
        desc: 'Tư duy chuyên sâu, giải bài toán khó và phân tích văn bản logic phức tạp.',
        badge: '🧠 Tư duy sâu',
        badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300',
      },
    ],
  },
  {
    id: 'openai' as const,
    name: 'OpenAI (ChatGPT)',
    icon: Bot,
    keyUrl: 'https://platform.openai.com/api-keys',
    keyLabel: 'Lấy key OpenAI',
    keyPlaceholder: 'Dán OpenAI API Key của bạn vào đây (Bắt đầu bằng sk-...)...',
    defaultModel: 'gpt-4o-mini',
    models: [
      {
        id: 'gpt-4o-mini',
        title: 'GPT-4o Mini',
        desc: 'Mô hình siêu nhanh, tiết kiệm chi phí và tối ưu cho tác vụ hàng ngày.',
        badge: '⚡ Siêu tốc',
        badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300',
      },
      {
        id: 'gpt-4o',
        title: 'GPT-4o Omni',
        desc: 'Mô hình flagship thông minh toàn diện, xử lý ngữ cảnh phức tạp.',
        badge: '🧠 Tư duy sâu',
        badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300',
      },
      {
        id: 'o3-mini',
        title: 'o3-mini Reasoning',
        desc: 'Tư duy logic chuyên sâu từng bước giải quyết bài toán phức tạp.',
        badge: '🎯 Lý luận',
        badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300',
      },
      {
        id: 'o1',
        title: 'OpenAI o1',
        desc: 'Mô hình suy luận cấp độ chuyên gia thế hệ mới của OpenAI.',
        badge: '🔬 Đỉnh cao',
        badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300',
      },
    ],
  },
  {
    id: 'claude' as const,
    name: 'Anthropic Claude',
    icon: Cpu,
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyLabel: 'Lấy key Claude',
    keyPlaceholder: 'Dán Anthropic API Key của bạn vào đây (Bắt đầu bằng sk-ant-...)...',
    defaultModel: 'claude-3-5-haiku-latest',
    models: [
      {
        id: 'claude-3-5-haiku-latest',
        title: 'Claude 3.5 Haiku',
        desc: 'Tốc độ phản hồi cực nhanh và tự nhiên, độ trễ cực thấp.',
        badge: '⚡ Siêu tốc',
        badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300',
      },
      {
        id: 'claude-3-5-sonnet-latest',
        title: 'Claude 3.5 Sonnet',
        desc: 'Tư duy ngôn ngữ sâu sắc và lập kế hoạch công việc chuẩn xác.',
        badge: '🧠 Tư duy sâu',
        badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300',
      },
      {
        id: 'claude-3-7-sonnet-latest',
        title: 'Claude 3.7 Sonnet',
        desc: 'Thế hệ mô hình kết hợp tư duy tức thì và suy luận chuyên sâu lai tạo.',
        badge: '🚀 Thế hệ mới',
        badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300',
      },
    ],
  },
  {
    id: 'deepseek' as const,
    name: 'DeepSeek AI',
    icon: Zap,
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyLabel: 'Lấy key DeepSeek',
    keyPlaceholder: 'Dán DeepSeek API Key của bạn vào đây (Bắt đầu bằng sk-...)...',
    defaultModel: 'deepseek-chat',
    models: [
      {
        id: 'deepseek-chat',
        title: 'DeepSeek-V3 Chat',
        desc: 'Hiệu năng phân tích tiếng Việt xuất sắc, chi phí siêu tiết kiệm.',
        badge: '🛡️ Ổn định',
        badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300',
      },
      {
        id: 'deepseek-reasoner',
        title: 'DeepSeek-R1 Reasoner',
        desc: 'Mô hình suy luận từng bước (Chain-of-Thought) cực kỳ mạnh mẽ.',
        badge: '🧠 Tư duy sâu',
        badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300',
      },
    ],
  },
  {
    id: 'openrouter' as const,
    name: 'OpenRouter Hub (Mọi Frontier Models)',
    icon: Globe,
    keyUrl: 'https://openrouter.ai/keys',
    keyLabel: 'Lấy key OpenRouter',
    keyPlaceholder: 'Dán OpenRouter API Key của bạn vào đây (Bắt đầu bằng sk-or-...)...',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct',
    models: [
      {
        id: 'meta-llama/llama-3.3-70b-instruct',
        title: 'Llama 3.3 70B (Meta)',
        desc: 'Mô hình mã nguồn mở hàng đầu định tuyến qua OpenRouter.',
        badge: '🛡️ Ổn định',
        badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300',
      },
      {
        id: 'qwen/qwen-2.5-coder-32b-instruct',
        title: 'Qwen 2.5 / 3 Coder',
        desc: 'Mô hình tư duy lập trình và phân tích cấu trúc logic xuất sắc của Alibaba Qwen.',
        badge: '💻 Coder',
        badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300',
      },
      {
        id: 'mistralai/codestral-2501',
        title: 'Codestral (Mistral)',
        desc: 'Mô hình chuyên biệt phân tích task và mã nguồn của Mistral AI.',
        badge: '⚡ Siêu tốc',
        badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300',
      },
      {
        id: 'x-ai/grok-2-1212',
        title: 'Grok 2 / Grok reasoning (xAI)',
        desc: 'Mô hình AI thông minh, tư duy sắc bén từ xAI định tuyến qua OpenRouter.',
        badge: '🔥 xAI',
        badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300',
      },
    ],
  },
  {
    id: 'custom' as const,
    name: 'Tùy chỉnh (Custom API / Local LLM)',
    icon: Sliders,
    keyUrl: '',
    keyLabel: '',
    keyPlaceholder: 'Dán Bearer Token hoặc API Key của Endpoint tùy chỉnh...',
    defaultModel: 'custom',
    models: [
      {
        id: 'custom',
        title: 'Tự do kết nối mọi Frontier Model',
        desc: 'Hỗ trợ bất kỳ endpoint nào (Ollama, vLLM, Groq, Kimi, GLM, Mistral, NVIDIA NIM Nemotron).',
        badge: '🛠️ Tùy biến',
        badgeColor: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200',
      },
    ],
  },
];

export const MascotSettingsModal: React.FC<MascotSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  personas,
  onUpdatePersonas,
  selectedPersonaId,
  onSelectPersona,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'models' | 'personas' | 'voice'>('models');
  const [localSettings, setLocalSettings] = useState<MascotAISettings>(settings);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isManualModelInput, setIsManualModelInput] = useState(settings.model === 'custom');

  // Persona tab states
  const [personaSearch, setPersonaSearch] = useState('');
  const [personaCategory, setPersonaCategory] = useState<string>('all');
  const [editingPersona, setEditingPersona] = useState<MascotPersona | null>(null);

  // Voice tab states
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [isPlayingSample, setIsPlayingSample] = useState(false);

  // API Connection test states
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  const handleTestConnection = async (overrideApiKey?: string) => {
    setIsTestingConnection(true);
    setTestResult(null);

    const effectiveModel =
      localSettings.model === 'custom' && localSettings.customModelName?.trim()
        ? localSettings.customModelName.trim()
        : localSettings.model;

    const keyToUse = overrideApiKey !== undefined ? overrideApiKey : localSettings.apiKey;

    const res = await testMascotAPIConnection({
      provider: localSettings.provider || 'gemini',
      model: effectiveModel,
      apiKey: keyToUse,
      customBaseUrl: localSettings.customBaseUrl,
    });

    setIsTestingConnection(false);
    setTestResult(res);

    if (res.ok) {
      onShowToast(`✓ ${res.message} (${res.latencyMs || 0}ms)`);
      // Auto-save verified key to ensure user doesn't lose it if they close the modal
      onSaveSettings(localSettings);
      try {
        localStorage.setItem('page_mascot_ai_settings_v1', JSON.stringify(localSettings));
        window.dispatchEvent(new CustomEvent('mascot_settings_changed', { detail: localSettings }));
      } catch {}
    } else {
      onShowToast(`✕ ${res.message}`);
    }
  };

  useEffect(() => {
    setLocalSettings(settings);
    setIsManualModelInput(settings.model === 'custom');
  }, [settings, isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadVoices().then((v) => setAvailableVoices(v));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentPersona = personas.find((p) => p.id === selectedPersonaId) || personas[0];

  // Voice test sample (Supports Vietnamese and English)
  const handleTestVoice = (forceLang?: 'vi' | 'en') => {
    if (isPlayingSample) {
      stopSpeaking();
      setIsPlayingSample(false);
      return;
    }

    const testLang = forceLang || (localSettings.voiceLanguage === 'en' ? 'en' : 'vi');
    const sampleText =
      testLang === 'en'
        ? `Hello! I am ${currentPersona.name}. I am ready to help you manage your projects and tasks smartly.`
        : `Xin chào! Tôi là ${currentPersona.name}. Tôi đã sẵn sàng hỗ trợ bạn quản lý dự án và công việc một cách thông minh.`;

    setIsPlayingSample(true);
    speakText(
      sampleText,
      {
        ...localSettings,
        voiceLanguage: testLang,
      },
      {
        onStart: () => setIsPlayingSample(true),
        onEnd: () => setIsPlayingSample(false),
        onError: () => setIsPlayingSample(false),
      }
    );
  };

  // Save all settings
  const handleSaveAndClose = () => {
    onSaveSettings(localSettings);
    try {
      localStorage.setItem('page_mascot_ai_settings_v1', JSON.stringify(localSettings));
      window.dispatchEvent(new CustomEvent('mascot_settings_changed', { detail: localSettings }));
    } catch {}
    onShowToast('Đã lưu cấu hình AI cá nhân!');
    onClose();
  };

  // Handle saving an edited persona
  const handleSavePersonaEdit = () => {
    if (!editingPersona) return;
    const updated = personas.map((p) => (p.id === editingPersona.id ? editingPersona : p));
    onUpdatePersonas(updated);
    saveStoredPersonas(updated);
    setEditingPersona(null);
    onShowToast(`Đã lưu thay đổi cho tính cách "${editingPersona.name}"!`);
  };

  // Filter personas
  const filteredPersonas = personas.filter((p) => {
    const matchCat = personaCategory === 'all' || p.category === personaCategory;
    const matchQuery =
      !personaSearch ||
      p.name.toLowerCase().includes(personaSearch.toLowerCase()) ||
      p.handle.toLowerCase().includes(personaSearch.toLowerCase()) ||
      p.tagline.toLowerCase().includes(personaSearch.toLowerCase());
    return matchCat && matchQuery;
  });

  // Current Provider info
  const currentProvider =
    AI_PROVIDERS.find((p) => p.id === localSettings.provider) || AI_PROVIDERS[0];

  // Effective model name for display
  const effectiveDisplayModel =
    localSettings.model === 'custom' && localSettings.customModelName?.trim()
      ? localSettings.customModelName.trim()
      : localSettings.model || currentProvider.defaultModel;

  // Active selected model object
  const activeSelectedModelObj = currentProvider.models.find(
    (m) => m.id === localSettings.model
  ) || {
    id: localSettings.model,
    title: effectiveDisplayModel,
    desc: 'Mô hình tùy chỉnh cá nhân đang hoạt động.',
    badge: 'Đang chọn',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300',
  };

  const handleSelectProvider = (provId: typeof AI_PROVIDERS[number]['id']) => {
    const targetProv = AI_PROVIDERS.find((p) => p.id === provId) || AI_PROVIDERS[0];
    setLocalSettings((s) => ({
      ...s,
      provider: provId,
      model: targetProv.defaultModel,
    }));
    setIsManualModelInput(provId === 'custom');
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-[#12161f] border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl flex flex-col text-xs animate-in zoom-in-95 duration-150 overflow-hidden">
        {/* Header (Exact structure from user mockup, adapted to app theme) */}
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between bg-white dark:bg-[#12161f]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-neutral-100">
                Thiết Lập API & Tính Cách Cá Nhân
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Lưu riêng cho tài khoản của bạn • Hoàn toàn độc lập & bảo mật
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector (Pill tabs style) */}
        <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/30">
          <div className="flex bg-neutral-200/50 dark:bg-neutral-800/60 p-1 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('models')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 ${
                activeTab === 'models'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>1. Mô Hình AI & Khóa API</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('personas')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 ${
                activeTab === 'personas'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>2. Tính Cách Linh Vật (@bot)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('voice')}
              className={`py-2 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 ${
                activeTab === 'voice'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
              title="Cài đặt giọng nói"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">3. Giọng Nói</span>
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* ================= TAB 1: MÔ HÌNH & API KEY ================= */}
          {activeTab === 'models' && (
            <div className="space-y-4">
              {/* 6 Provider Selection Grid (3x2 on desktop, 2 cols on mobile) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {AI_PROVIDERS.map((prov) => {
                  const isSelected = localSettings.provider === prov.id;
                  const IconComp = prov.icon;
                  return (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => handleSelectProvider(prov.id)}
                      className={`p-2.5 rounded-2xl border text-left transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'border-2 border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 font-bold shadow-xs'
                          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium'
                      }`}
                    >
                      <div
                        className={`p-1.5 rounded-xl shrink-0 ${
                          isSelected
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                        }`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs truncate">{prov.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Recommended Models Section */}
              <div className="space-y-2">
                {/* Section Header */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    MỤC TIÊU ĐỀ XUẤT CHO {currentProvider.name.toUpperCase()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsManualModelInput(!isManualModelInput)}
                    className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold text-xs transition"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{isManualModelInput ? 'Chọn từ danh sách' : 'Tự gõ model bằng tay'}</span>
                  </button>
                </div>

                {!isManualModelInput ? (
                  <div className="space-y-2">
                    {/* Active Selected Model Banner (Matches top banner in user image) */}
                    {activeSelectedModelObj && (
                      <div className="p-3 rounded-2xl border-2 border-emerald-500/80 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs">{activeSelectedModelObj.title}</span>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${activeSelectedModelObj.badgeColor}`}
                          >
                            {activeSelectedModelObj.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
                          {activeSelectedModelObj.desc}
                        </p>
                      </div>
                    )}

                    {/* Other Model Cards in the provider's recommendation list */}
                    <div className="space-y-1.5">
                      {currentProvider.models
                        .filter((m) => m.id !== localSettings.model)
                        .map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setLocalSettings((s) => ({ ...s, model: m.id }))}
                            className="w-full text-left p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 hover:border-emerald-300 dark:hover:border-emerald-800/80 transition-all flex items-center justify-between gap-3"
                          >
                            <div className="space-y-0.5 min-w-0">
                              <div className="font-bold text-xs text-neutral-800 dark:text-neutral-200">
                                {m.title}
                              </div>
                              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                                {m.desc}
                              </p>
                            </div>
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${m.badgeColor}`}
                            >
                              {m.badge}
                            </span>
                          </button>
                        ))}
                    </div>

                    {/* Dashed Button to Add/Type custom model into the list */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualModelInput(true);
                        setLocalSettings((s) => ({ ...s, model: 'custom' }));
                      }}
                      className="w-full py-2.5 rounded-2xl border-2 border-dashed border-emerald-300/80 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Thêm model tùy chọn vào danh sách {currentProvider.name}</span>
                    </button>
                  </div>
                ) : (
                  /* Manual Custom Model Input */
                  <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/90 border-2 border-emerald-400 dark:border-emerald-700/60 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        Nhập Model ID chính xác của bạn:
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsManualModelInput(false);
                          setLocalSettings((s) => ({ ...s, model: currentProvider.defaultModel }));
                        }}
                        className="text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 underline"
                      >
                        Quay lại chọn danh sách
                      </button>
                    </div>
                    <input
                      type="text"
                      value={
                        localSettings.customModelName ||
                        (localSettings.model !== 'custom' ? localSettings.model : '')
                      }
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setLocalSettings((s) => ({ ...s, model: 'custom', customModelName: val }));
                      }}
                      placeholder="Ví dụ: gemini-3.8-flash, deepseek-chat, gpt-4o-mini, claude-3-7-sonnet..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-xs font-mono text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    />
                    <p className="text-[10px] text-neutral-500">
                      Hệ thống sẽ gửi yêu cầu trực tiếp tới Model ID này khi bạn tương tác với Mascot.
                    </p>
                  </div>
                )}
              </div>

              {/* API Key Section (Exact match to image card) */}
              <div className="p-4 rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    <Key className="w-3.5 h-3.5 text-emerald-500" />
                    <span>API Key của {currentProvider.name}</span>
                  </div>
                  {currentProvider.keyUrl && (
                    <a
                      href={currentProvider.keyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 font-medium"
                    >
                      <span>{currentProvider.keyLabel || 'Lấy key'}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>

                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={localSettings.apiKey}
                    onChange={(e) => {
                      const cleaned = e.target.value
                        .trim()
                        .replace(/^["']|["']$/g, '')
                        .replace(/^Bearer\s+/i, '');
                      setLocalSettings((s) => ({ ...s, apiKey: cleaned }));
                    }}
                    placeholder={currentProvider.keyPlaceholder}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 text-xs font-mono text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    title={showApiKey ? 'Ẩn API Key' : 'Hiện API Key'}
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* API Key Status & Clear Action */}
                {currentProvider.id === 'gemini' && (
                  <div className="space-y-1.5 pt-1">
                    {!localSettings.apiKey ? (
                      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-400/40 text-xs space-y-1 text-amber-900 dark:text-amber-200">
                        <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>Chưa nhập Gemini API Key</span>
                        </div>
                        <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                          Nhập Gemini API Key cá nhân để trợ lý thoại phản hồi ổn định và không bị giới hạn lưu lượng.
                        </p>
                        <div className="pt-0.5">
                          <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Lấy API Key miễn phí tại Google AI Studio ↗</span>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[11px] pt-0.5">
                        <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Đã lưu API Key cá nhân của bạn</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setLocalSettings((s) => ({ ...s, apiKey: '' }));
                            onShowToast('Đã xóa key cá nhân');
                          }}
                          className="text-rose-500 hover:text-rose-600 dark:text-rose-400 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          Xóa key
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Custom Base URL if custom or openrouter or deepseek */}
                {(localSettings.provider === 'custom' ||
                  localSettings.provider === 'openrouter' ||
                  localSettings.provider === 'deepseek') && (
                  <div className="space-y-1 pt-1">
                    <label className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400">
                      Custom Base URL (Tùy chọn):
                    </label>
                    <input
                      type="text"
                      value={localSettings.customBaseUrl || ''}
                      onChange={(e) =>
                        setLocalSettings((s) => ({
                          ...s,
                          customBaseUrl: e.target.value.trim(),
                        }))
                      }
                      placeholder={
                        localSettings.provider === 'openrouter'
                          ? 'https://openrouter.ai/api/v1'
                          : localSettings.provider === 'deepseek'
                          ? 'https://api.deepseek.com'
                          : 'https://openrouter.ai/api/v1 hoặc http://localhost:11434/v1'
                      }
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 text-xs font-mono text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 outline-hidden"
                    />
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 dark:text-neutral-400 pt-0.5">
                  <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span>
                    Khóa API được lưu riêng cho tài khoản của bạn, không ảnh hưởng đến người dùng khác.
                  </span>
                </div>
              </div>

              {/* API Connection Testing Card */}
              <div className="p-4 rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/90 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    <Activity className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Kiểm tra kết nối API ({currentProvider.name})</span>
                  </div>
                  <button
                    type="button"
                    disabled={isTestingConnection}
                    onClick={() => handleTestConnection()}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                      isTestingConnection
                        ? 'bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 hover:shadow-emerald-500/20'
                    }`}
                  >
                    {isTestingConnection ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang kiểm tra...</span>
                      </>
                    ) : (
                      <>
                        <Wifi className="w-3.5 h-3.5" />
                        <span>Kiểm tra ngay</span>
                      </>
                    )}
                  </button>
                </div>

                {/* State: When tested (Result box) */}
                {testResult && (
                  <div
                    className={`p-3.5 rounded-2xl border transition-all text-xs ${
                      testResult.ok
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-100'
                        : 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80 text-rose-950 dark:text-rose-100'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {testResult.ok ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-bold text-xs">
                            {testResult.ok ? 'Kết nối API hoạt động hoàn hảo' : 'Kết nối API thất bại'}
                          </span>
                          {testResult.latencyMs !== undefined && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                                testResult.ok
                                  ? 'bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200'
                                  : 'bg-rose-200/80 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200'
                              }`}
                            >
                              Độ trễ: {testResult.latencyMs}ms
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] leading-relaxed opacity-90">
                          {testResult.message}
                        </p>

                        {/* Additional stats if ok */}
                        {testResult.ok && (
                          <div className="flex items-center gap-2 pt-1 text-[10px] text-neutral-600 dark:text-neutral-300 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-white/70 dark:bg-neutral-800/80 border border-emerald-200/50 dark:border-emerald-800/50 font-mono">
                              Model: {testResult.modelUsed}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-white/70 dark:bg-neutral-800/80 border border-emerald-200/50 dark:border-emerald-800/50">
                              Nguồn: {testResult.keySource === 'system' ? 'Key hệ thống Google AI Studio' : 'Key cá nhân tùy chỉnh'}
                            </span>
                            {testResult.sampleReply && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100/60 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-mono">
                                Phản hồi: "{testResult.sampleReply}"
                              </span>
                            )}
                          </div>
                        )}

                        {/* Suggestion to switch to system key if custom key is invalid */}
                        {!testResult.ok && testResult.canFallbackToSystemKey && (
                          <div className="pt-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setLocalSettings((s) => ({ ...s, apiKey: '' }));
                                handleTestConnection('');
                              }}
                              className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Xóa key cá nhân lỗi & kiểm tra với Key mặc định hệ thống</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* State: When idle (not tested yet) */}
                {!testResult && !isTestingConnection && (
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Bấm nút <strong>"Kiểm tra ngay"</strong> để gửi gói tin ping thử nghiệm, đo đạc độ trễ phản hồi (latency) và xác minh tính hợp lệ của API Key cùng mô hình đã chọn.
                  </p>
                )}
              </div>

              {/* Failover Protection Notice */}
              <div className="p-3 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-[11px] flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                    Cơ chế Rollback Model Tự Động (Failover Protection)
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-200/70 dark:bg-emerald-800/60 font-semibold text-emerald-900 dark:text-emerald-200">
                      Đang bật
                    </span>
                  </span>
                  <p className="text-[10px] text-emerald-700/90 dark:text-emerald-300/80 leading-relaxed">
                    Khi mô hình bạn chọn bị lỗi, quá tải (503) hoặc chạm ngưỡng quota (429), API sẽ tự động chuyển tiếp sang các model dự phòng tiếp theo trong cùng thiết lập API Key để đảm bảo không bị đứt đoạn.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: TÍNH CÁCH & PERSONA MASCOT ================= */}
          {activeTab === 'personas' && (
            <div className="space-y-4">
              {editingPersona ? (
                /* Persona In-Place Editor */
                <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center shrink-0 overflow-hidden">
                        <MascotSpriteAvatar persona={editingPersona} size={34} interactive={false} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          Chỉnh sửa: {editingPersona.name}
                        </h4>
                        <span className="text-[10px] text-amber-600 font-mono">
                          {editingPersona.handle}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingPersona(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs underline"
                    >
                      Quay lại
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-[11px] text-slate-700 dark:text-slate-300">
                      Tên hiển thị:
                    </label>
                    <input
                      type="text"
                      value={editingPersona.name}
                      onChange={(e) =>
                        setEditingPersona({ ...editingPersona, name: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-[11px] text-slate-700 dark:text-slate-300">
                      Khẩu hiệu / Giới thiệu ngắn:
                    </label>
                    <input
                      type="text"
                      value={editingPersona.tagline}
                      onChange={(e) =>
                        setEditingPersona({ ...editingPersona, tagline: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-[11px] text-slate-700 dark:text-slate-300">
                      System Prompt tính cách (Cách xưng hô, thái độ, phản xạ):
                    </label>
                    <textarea
                      rows={5}
                      value={editingPersona.prompt}
                      onChange={(e) =>
                        setEditingPersona({ ...editingPersona, prompt: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 font-mono leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingPersona(null)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePersonaEdit}
                      className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-sm"
                    >
                      Lưu thay đổi tính cách
                    </button>
                  </div>
                </div>
              ) : (
                /* Persona Browser & Selector */
                <div className="space-y-3">
                  {/* Category filters & Search */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 justify-between">
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                      {[
                        { id: 'all', label: 'Tất cả' },
                        { id: 'authority', label: 'Quyền uy' },
                        { id: 'friendly', label: 'Bạn bè' },
                        { id: 'funny', label: 'Hài hước' },
                        { id: 'fantasy', label: 'Kỳ ảo' },
                        { id: 'unique', label: 'Đặc sắc' },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setPersonaCategory(cat.id)}
                          className={`px-2.5 py-1 rounded-xl font-medium transition shrink-0 ${
                            personaCategory === cat.id
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={personaSearch}
                        onChange={(e) => setPersonaSearch(e.target.value)}
                        placeholder="Tìm tính cách..."
                        className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Active Persona Spotlight Card */}
                  <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-700/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 flex items-center justify-center">
                        <MascotSpriteAvatar persona={currentPersona} size={44} interactive={false} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                            {currentPersona.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-amber-500 text-white rounded-full font-medium">
                            Đang kích hoạt
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">{currentPersona.tagline}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditingPersona(currentPersona)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 font-bold hover:shadow-xs transition"
                    >
                      Sửa Prompt
                    </button>
                  </div>

                  {/* Persona Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {filteredPersonas.map((p) => {
                      const isActive = p.id === selectedPersonaId;
                      return (
                        <div
                          key={p.id}
                          className={`p-2.5 rounded-2xl border transition-all flex items-start justify-between gap-2 ${
                            isActive
                              ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                          }`}
                        >
                          <div
                            onClick={() => {
                              onSelectPersona(p.id);
                              const updated = { ...localSettings, personaId: p.id };
                              setLocalSettings(updated);
                              try {
                                localStorage.setItem('page_mascot_ai_settings_v1', JSON.stringify(updated));
                                window.dispatchEvent(new CustomEvent('mascot_settings_changed', { detail: updated }));
                              } catch {}
                              onShowToast(`Đã đổi sang tính cách "${p.name}"!`);
                            }}
                            className="flex items-start gap-2.5 flex-1 cursor-pointer min-w-0"
                          >
                            <div className="shrink-0 flex items-center justify-center mt-0.5">
                              <MascotSpriteAvatar persona={p} size={34} interactive={false} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                                  {p.name}
                                </span>
                                {isActive && (
                                  <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 truncate">{p.tagline}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setEditingPersona(p)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg shrink-0"
                            title="Chỉnh sửa tính cách này"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reset Personas Button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Khôi phục toàn bộ 36+ tính cách về mặc định gốc?')) {
                          const original = resetStoredPersonas();
                          onUpdatePersonas(original);
                          onShowToast('Đã khôi phục tính cách về mặc định!');
                        }
                      }}
                      className="text-slate-400 hover:text-rose-500 flex items-center gap-1 text-[10px]"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Khôi phục 36+ tính cách về gốc</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: GIỌNG NÓI & HỘI THOẠI ================= */}
          {activeTab === 'voice' && (
            <div className="space-y-4">
              {/* 1. Language Preference Selector */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5 text-amber-500" />
                    <span>Ngôn ngữ giọng đọc & Giao tiếp (Language):</span>
                  </span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                    {localSettings.voiceLanguage === 'vi'
                      ? '🇻🇳 Tiếng Việt'
                      : localSettings.voiceLanguage === 'en'
                      ? '🇬🇧 English'
                      : '🌐 Tự động nhận diện'}
                  </span>
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      id: 'vi',
                      flag: '🇻🇳',
                      title: 'Tiếng Việt',
                      sub: 'Giọng đọc & Micro tiếng Việt chuẩn',
                    },
                    {
                      id: 'en',
                      flag: '🇬🇧',
                      title: 'English',
                      sub: 'Natural English speech & mic',
                    },
                    {
                      id: 'auto',
                      flag: '🌐',
                      title: 'Tự động',
                      sub: 'Tự nhận diện câu trả lời theo ngữ cảnh',
                    },
                  ].map((item) => {
                    const isSelected = (localSettings.voiceLanguage || 'vi') === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setLocalSettings((s) => ({
                            ...s,
                            voiceLanguage: item.id as 'vi' | 'en' | 'auto',
                          }))
                        }
                        className={`p-2.5 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/10 text-amber-950 dark:text-amber-100 shadow-xs ring-1 ring-amber-500'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{item.flag}</span>
                          <span className="font-bold text-xs">{item.title}</span>
                        </div>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                          {item.sub}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Voice Engine Selector (Cloud TTS vs Browser Speech) */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Công nghệ giọng đọc (Voice Engine):</span>
                  <span className="text-[10px] text-slate-400">
                    {localSettings.voiceEngine === 'cloud' ? '☁️ Cloud Audio (Khuyên dùng)' : '💻 Web Speech'}
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLocalSettings((s) => ({ ...s, voiceEngine: 'cloud' }))}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      (localSettings.voiceEngine || 'cloud') === 'cloud'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-950 dark:text-amber-100 shadow-xs ring-1 ring-amber-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <span>☁️ Google Cloud TTS</span>
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold">
                        Khuyên dùng
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                      Đảm bảo 100% phát âm Tiếng Việt và Tiếng Anh cực chuẩn, trong trẻo, tự nhiên trên mọi thiết bị và hệ điều hành (không phụ thuộc vào máy có cài gói tiếng Việt hay không).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLocalSettings((s) => ({ ...s, voiceEngine: 'browser' }))}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      localSettings.voiceEngine === 'browser'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-950 dark:text-amber-100 shadow-xs ring-1 ring-amber-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <span>💻 Giọng hệ thống thiết bị</span>
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                        Web Speech
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                      Sử dụng các gói giọng nói cài sẵn trên trình duyệt máy bạn (Microsoft Hoài My, Google Tiếng Việt, Apple Linh, v.v.).
                    </p>
                  </button>
                </div>

                {/* If Browser Engine is selected, show Voice Dropdown and warning if no VN voice */}
                {localSettings.voiceEngine === 'browser' && (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Chọn giọng đọc cụ thể trên máy:
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {availableVoices.length} giọng sẵn có
                      </span>
                    </div>

                    <select
                      value={localSettings.voiceURI || ''}
                      onChange={(e) =>
                        setLocalSettings((s) => ({ ...s, voiceURI: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-hidden"
                    >
                      <option value="">-- Tự động chọn giọng phù hợp nhất --</option>
                      {availableVoices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.isVietnamese ? '🇻🇳 [Tiếng Việt] ' : v.isEnglish ? '🇬🇧 [English] ' : '🌐 '} {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>

                    {/* Notice if no Vietnamese voice detected on local OS */}
                    {!availableVoices.some((v) => v.isVietnamese) && (
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                        <span className="text-base">⚠️</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-amber-800 dark:text-amber-200 leading-tight">
                            Hệ điều hành / trình duyệt của bạn chưa cài gói giọng nói Tiếng Việt.
                          </p>
                          <button
                            type="button"
                            onClick={() => setLocalSettings((s) => ({ ...s, voiceEngine: 'cloud' }))}
                            className="text-[10px] font-bold text-amber-700 dark:text-amber-300 underline mt-1 block hover:text-amber-800"
                          >
                            👉 Bấm vào đây để chuyển sang Google Cloud TTS (phát âm Tiếng Việt chuẩn 100%)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Pitch & Speed & Volume Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Tốc độ nói (Speed):
                    </span>
                    <span className="font-mono text-amber-600 font-bold">
                      {localSettings.voiceRate || 1.0}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.5"
                    step="0.05"
                    value={localSettings.voiceRate || 1.0}
                    onChange={(e) =>
                      setLocalSettings((s) => ({ ...s, voiceRate: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Cao độ giọng (Pitch):
                    </span>
                    <span className="font-mono text-amber-600 font-bold">
                      {localSettings.voicePitch || 1.0}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.3"
                    step="0.05"
                    value={localSettings.voicePitch || 1.0}
                    onChange={(e) =>
                      setLocalSettings((s) => ({ ...s, voicePitch: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* 4. Dual Language Sample Audio Playback Buttons */}
              <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-xs text-amber-900 dark:text-amber-200">
                      Nghe thử giọng mẫu (Voice Preview):
                    </h5>
                    <p className="text-[10px] text-amber-700 dark:text-amber-300">
                      Kiểm tra âm điệu nhân vật &ldquo;{currentPersona.name}&rdquo; bằng Tiếng Việt hoặc English
                    </p>
                  </div>
                  {isPlayingSample && (
                    <button
                      type="button"
                      onClick={() => {
                        stopSpeaking();
                        setIsPlayingSample(false);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-rose-600 text-white font-bold text-[10px] flex items-center gap-1 shadow-xs"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Dừng phát</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleTestVoice('vi')}
                    className="px-3 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white shadow-xs text-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>🇻🇳 Nghe thử Tiếng Việt</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTestVoice('en')}
                    className="px-3 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs text-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>🇬🇧 Nghe thử English</span>
                  </button>
                </div>
              </div>

              {/* 5. Voice Feature Toggles */}
              <div className="space-y-2 pt-1">
                {/* Auto Speak Toggle */}
                <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Tự động đọc phản hồi (Auto TTS)
                    </span>
                    <p className="text-[10px] text-slate-500">
                      Khi AI trả lời tin nhắn, tự động phát âm thanh giọng nói của Mascot theo ngôn ngữ đã chọn.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.autoSpeak}
                    onChange={(e) =>
                      setLocalSettings((s) => ({ ...s, autoSpeak: e.target.checked }))
                    }
                    className="w-4 h-4 accent-amber-500 rounded-md cursor-pointer"
                  />
                </label>

                {/* Continuous Voice Dialogue Toggle */}
                <label className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span>Chế độ đối thoại rảnh tay (ChatGPT Voice Mode)</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-normal">
                        Rảnh tay
                      </span>
                    </span>
                    <p className="text-[10px] text-slate-500">
                      Hỏi qua đáp lại liên tục: Khi AI nói xong sẽ tự động bật lại micro để nghe bạn nói tiếp mà không cần bấm thêm nút nào.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.continuousVoiceMode}
                    onChange={(e) =>
                      setLocalSettings((s) => ({ ...s, continuousVoiceMode: e.target.checked }))
                    }
                    className="w-4 h-4 accent-amber-500 rounded-md cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons (Matched with user design mockup) */}
        <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-500 dark:text-neutral-400">Model:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60">
              {effectiveDisplayModel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLocalSettings(DEFAULT_AI_SETTINGS);
                onShowToast('Đã đặt lại các thiết lập AI về mặc định');
              }}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 text-[11px] px-2 py-1.5 transition"
            >
              Mặc định
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-semibold transition"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md flex items-center gap-1.5 transition active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Lưu Thiết Lập Cá Nhân</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
