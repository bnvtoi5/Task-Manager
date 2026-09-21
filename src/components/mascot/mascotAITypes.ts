export type MascotActionType =
  | 'create_task'
  | 'update_task'
  | 'move_task'
  | 'delete_task'
  | 'set_alarm'
  | 'cancel_alarm'
  | 'create_cluster'
  | 'update_cluster'
  | 'delete_cluster'
  | 'create_division'
  | 'update_division'
  | 'delete_division'
  | 'create_period'
  | 'update_period'
  | 'delete_period'
  | 'create_workspace'
  | 'update_workspace'
  | 'delete_workspace'
  | 'create_board_mode'
  | 'update_board_mode'
  | 'delete_board_mode';

export interface ActionProposal {
  id: string;
  action: MascotActionType;
  target_name: string;
  summary: string;
  details: Record<string, any>;
  status?: 'pending' | 'accepted' | 'rejected' | 'executed';
}

export interface MascotChatReplyContext {
  id: string;
  role: 'user' | 'assistant' | 'system';
  senderName?: string;
  content: string;
}

export interface MascotChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  replyTo?: MascotChatReplyContext;
  proposals?: ActionProposal[];
  isThinking?: boolean;
  quickActions?: { label: string; action: string; isTemplate?: boolean }[];
  modelUsed?: string;
  fellBack?: boolean;
}

export interface MascotAISettings {
  apiKey: string;
  provider: 'gemini' | 'openai' | 'claude' | 'deepseek' | 'openrouter' | 'custom';
  model: string;
  customModelName?: string;
  customBaseUrl?: string;
  personaId: string;
  temperature: number;
  // Voice settings
  voiceEnabled: boolean;
  autoSpeak: boolean;
  continuousVoiceMode: boolean;
  voiceEngine: 'cloud' | 'browser'; // 'cloud' uses Google Cloud TTS (/api/mascot/tts) for 100% natural VN & EN voice, 'browser' uses local device voices
  voiceLanguage: 'vi' | 'en' | 'auto'; // 'vi' = Tiếng Việt, 'en' = English, 'auto' = tự động theo nội dung
  voiceURI: string;
  voiceRate: number; // 0.7 to 1.5
  voicePitch: number; // 0.8 to 1.3
  voiceVolume?: number; // 0.1 to 1.0
}

export const DEFAULT_AI_SETTINGS: MascotAISettings = {
  apiKey: '',
  provider: 'gemini',
  model: 'gemini-3.1-flash-lite',
  customModelName: '',
  customBaseUrl: '',
  personaId: 'bunny',
  temperature: 0.7,
  voiceEnabled: true,
  autoSpeak: false,
  continuousVoiceMode: false,
  voiceEngine: 'cloud',
  voiceLanguage: 'vi',
  voiceURI: '',
  voiceRate: 1.0,
  voicePitch: 1.0,
  voiceVolume: 1.0,
};

export const AI_SETTINGS_STORAGE_KEY = 'page_mascot_ai_settings_v1';
export const CHAT_HISTORY_STORAGE_KEY = 'page_mascot_ai_chat_history_v1';
