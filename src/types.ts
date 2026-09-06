export type FishAudioEmotion =
  | 'gentle'
  | 'friendly'
  | 'professional'
  | 'serious'
  | 'cheerful'
  | 'enthusiastic'
  | 'confident'
  | 'authoritative'
  | 'empathetic'
  | 'playful'
  | 'dramatic'
  | 'intimate'
  | 'mysterious'
  | 'sad'
  | 'angry'
  | 'sexy';

export type Emotion =
  | FishAudioEmotion
  // Positive / Warm / Open
  | 'neutral'
  | 'calm'
  | 'happy'
  | 'joyful'
  | 'excited'
  | 'playful'
  | 'amused'
  | 'curious'
  | 'interested'
  | 'confident'
  | 'proud'
  | 'warm'
  | 'friendly'
  | 'affectionate'
  | 'caring'
  | 'comforting'
  | 'hopeful'
  | 'grateful'
  | 'relieved'
  // Vulnerable / Soft / Reactive
  | 'sad'
  | 'lonely'
  | 'disappointed'
  | 'melancholic'
  | 'nervous'
  | 'worried'
  | 'concerned'
  | 'afraid'
  | 'surprised'
  | 'shocked'
  | 'confused'
  | 'embarrassed'
  | 'shy'
  // Firm / Agitated / Challenged
  | 'annoyed'
  | 'irritated'
  | 'frustrated'
  | 'angry'
  | 'jealous'
  | 'impatient'
  | 'disapproving'
  // Reflective / Serious / Mysterious
  | 'serious'
  | 'focused'
  | 'determined'
  | 'protective'
  | 'suspicious'
  | 'cautious'
  | 'mysterious'
  | 'cold'
  | 'distant'
  | 'thoughtful'
  // Teasing / Witty
  | 'teasing'
  | 'mischievous'
  | 'sarcastic'
  | 'playfully_provocative'
  | 'sleepy'
  | 'thinking'
  | 'relaxed'
  | 'wink';

export type ColumbinaAction =
  | 'idle'
  | 'look_at_user'
  | 'small_head_tilt'
  | 'slow_blink'
  | 'blink'
  | 'smile'
  | 'soft_smile'
  | 'small_laugh'
  | 'giggle'
  | 'look_curious'
  | 'lean_forward'
  | 'lean_backward'
  | 'nod'
  | 'small_shake_of_head'
  | 'look_surprised'
  | 'look_concerned'
  | 'look_confused'
  | 'look_embarrassed'
  | 'look_away_briefly'
  | 'look_down_briefly'
  | 'close_eyes_calmly'
  | 'hand_gesture'
  | 'small_wave'
  | 'raise_hand'
  | 'point'
  | 'open_palm_gesture'
  | 'touch_chest'
  | 'cross_arms'
  | 'rest_hands_naturally'
  | 'small_shoulder_movement'
  | 'gentle_breathing'
  | 'subtle_sway'
  | 'thoughtful_pose'
  | 'serious_posture'
  | 'protective_posture'
  | 'playful_gesture'
  | 'teasing_gesture'
  | 'excited_gesture'
  | 'surprised_reaction'
  | 'concerned_reaction'
  | 'comforting_gesture'
  | 'greeting'
  | 'farewell';

export type ColumbinaFacialExpression =
  | 'neutral'
  | 'happy'
  | 'excited'
  | 'curious'
  | 'sad'
  | 'concerned'
  | 'surprised'
  | 'confused'
  | 'embarrassed'
  | 'angry'
  | 'serious'
  | 'playful'
  | 'teasing'
  | 'mysterious'
  | 'soft_smile'
  | 'mischievous'
  | 'thoughtful'
  | 'cold';

export type ColumbinaVoiceStyle =
  | 'calm'
  | 'happy'
  | 'excited'
  | 'sad'
  | 'concerned'
  | 'serious'
  | 'playful'
  | 'teasing'
  | 'mysterious'
  | 'angry'
  | 'warm_playful'
  | 'gentle_whisper'
  | 'intimate_soft'
  | 'thoughtful_calm'
  | 'curious_bright';

export type CharacterAnimation =
  | 'idle'
  | 'talking'
  | 'happy'
  | 'sad'
  | 'surprised'
  | 'thinking'
  | 'excited'
  | 'sleepy'
  | ColumbinaAction;

export interface EmotionEngineMetadata {
  emotion: Emotion;
  intensity: number;
  userEmotion?: string;
  voiceStyle?: string;
  voiceSpeed?: number;
  voicePitch?: number;
  facialExpression?: ColumbinaFacialExpression | string;
  action?: ColumbinaAction | string;
  gesture?: string;
}

export type Personality = 'ethereal' | 'companion' | 'cyberpunk' | 'mentor' | 'professional';

export type LightingPreset = 'studio' | 'cyberpunk' | 'sunset' | 'soft' | 'neon';

export type BackgroundPreset = 'gradient' | 'cyber' | 'studio' | 'zen' | 'transparent';

export type CameraPreset = 'portrait' | 'upper' | 'full';

export type ColumbinaLanguage = 'English' | 'Hindi' | 'Bengali' | 'Japanese';

export type AIBrainMode =
  | 'auto'
  | 'gemini'
  | 'openai'
  | 'groq'
  | 'openrouter'
  | 'huggingface'
  | 'opencode'
  | 'kilo';

export interface ExecutionDiagnostic {
  selectedProvider: string;
  selectedModel: string;
  taskType: string;
  selectionReason: string;
  latencyMs: number;
  success: boolean;
  fallbackUsed: boolean;
  attemptedProviders: string[];
  errors?: Record<string, string>;
}

export interface ProviderSafeStatus {
  id: string;
  name: string;
  configured: boolean;
  available: boolean;
  status: 'healthy' | 'degraded' | 'cooldown' | 'unconfigured' | 'offline';
  avgLatencyMs?: number;
  model?: string;
  capabilities?: {
    chat?: boolean;
    coding?: boolean;
    reasoning?: boolean;
    fast?: boolean;
    streaming?: boolean;
    multimodal?: boolean;
    github?: boolean;
  };
}

export interface StructuredAIResponse {
  message: string;
  cleanText?: string;
  text?: string;
  emotion: Emotion;
  intensity: number;
  userEmotion?: string;
  voiceStyle?: string;
  voiceSpeed?: number;
  voicePitch?: number;
  facialExpression?: ColumbinaFacialExpression | string;
  action?: ColumbinaAction | string;
  gesture?: string;
  expression?: string;
  voice_direction?: string;
  animation: CharacterAnimation;
  currentLanguage?: ColumbinaLanguage;
  brain?: string;
  diagnostic?: ExecutionDiagnostic;
}

export interface CharacterMemory {
  userPreferences: string[];
  importantFacts: string[];
  relationshipContext: string[];
  conversationSummary: string;
}

export interface VoiceEmotionSignal {
  primary:
    | 'sad'
    | 'cheerful'
    | 'hesitant'
    | 'playful'
    | 'angry'
    | 'calm'
    | 'gentle'
    | 'neutral'
    | 'curious'
    | 'mysterious'
    | 'intimate'
    | 'enthusiastic';
  confidence: number;
  intensity: number;
}

export interface ParalinguisticAnalysis {
  rawTranscript: string;
  cleanedTranscript: string;
  vocalSound?:
    | 'hmm'
    | 'mmm'
    | 'hmph'
    | 'hmp'
    | 'sigh'
    | 'laugh'
    | 'cry'
    | 'whisper'
    | 'gasp'
    | 'shout'
    | 'hesitation'
    | 'none';
  tone?: string;
  pitch?: 'high' | 'normal' | 'low';
  speakingSpeed?: 'fast' | 'normal' | 'slow';
  loudness?: 'whisper' | 'quiet' | 'normal' | 'loud' | 'shout';
  pauses?: number;
  isShaky?: boolean;
  voiceEmotion?: VoiceEmotionSignal;
  contextInterpretation?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  cleanText?: string;
  emotion?: Emotion;
  intensity?: number;
  userEmotion?: string;
  voiceStyle?: string;
  voiceSpeed?: number;
  voicePitch?: number;
  facialExpression?: ColumbinaFacialExpression | string;
  action?: ColumbinaAction | string;
  gesture?: string;
  expression?: string;
  voice_direction?: string;
  animation?: CharacterAnimation;
  timestamp: number;
  isAudioPlaying?: boolean;
  language?: ColumbinaLanguage;
  voiceAnalysis?: ParalinguisticAnalysis;
  brain?: string;
  diagnostic?: ExecutionDiagnostic;
}

export interface AssistantConfig {
  aiBrain: AIBrainMode;
  personality: Personality;
  userName: string;
  voiceSpeed: number;
  voicePitch: number;
  autoSpeak: boolean;
  selectedVoiceURI: string;
  ttsEngine: 'fish' | 'webspeech' | 'gemini';
  fishReferenceId: string;
  modelUrl: string;
  lightingPreset: LightingPreset;
  backgroundPreset: BackgroundPreset;
  cameraPreset: CameraPreset;
  soundEffects: boolean;
  speechLanguage: string;
  currentLanguage: ColumbinaLanguage;
}

export interface VoiceCorrectionResult {
  isNoise?: boolean;
  rawTranscript: string;
  correctedText: string;
  confidence: number;
  needsClarification: boolean;
  clarificationText?: string;
  reason?: string;
  voiceAnalysis?: ParalinguisticAnalysis;
}

export interface VRMModelMeta {
  title?: string;
  author?: string;
  version?: string;
  contactInformation?: string;
  allowedUser?: string;
}

export type CameraState =
  | 'CAMERA_OFF'
  | 'CAMERA_REQUESTING_PERMISSION'
  | 'CAMERA_ON'
  | 'CAMERA_SWITCHING'
  | 'CAMERA_ERROR';

export type CameraFacingMode = 'user' | 'environment';

export type CameraCommandType =
  | 'turn_on'
  | 'turn_off'
  | 'switch_camera'
  | 'front_camera'
  | 'back_camera'
  | 'look_at_this';

export interface CameraCommandParseResult {
  isCommand: boolean;
  type?: CameraCommandType;
  facingMode?: CameraFacingMode;
  responsePrompt?: string;
}

export interface VisionFrameData {
  base64Image: string;
  mimeType: string;
  timestamp: number;
  facingMode: CameraFacingMode;
}

