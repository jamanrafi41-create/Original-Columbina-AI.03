export type TaskType =
  | 'chat'
  | 'reasoning'
  | 'coding'
  | 'github'
  | 'fast'
  | 'analysis'
  | 'multimodal'
  | 'voice_live';

export type ProviderHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'cooldown'
  | 'unavailable'
  | 'unconfigured';

export interface ProviderCapabilities {
  chat: boolean;
  reasoning: boolean;
  coding: boolean;
  github: boolean;
  multimodal: boolean;
  streaming: boolean;
  voiceLive: boolean;
  fastTasks: boolean;
}

export interface ProviderHealthRecord {
  id: string;
  name: string;
  status: ProviderHealthStatus;
  isConfigured: boolean;
  isAvailable: boolean;
  failureCount: number;
  lastSuccess?: number;
  lastFailure?: number;
  lastError?: string;
  cooldownUntil?: number;
  averageLatencyMs?: number;
}

export interface ChatTurnMessage {
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
  cleanText?: string;
  voiceAnalysis?: any;
  image?: string; // base64 data URL or raw base64 string
  isCameraActive?: boolean;
}

export interface GenerateRequest {
  messages: ChatTurnMessage[];
  systemInstruction: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  taskType?: TaskType;
  metadata?: Record<string, any>;
  signal?: AbortSignal;
}

export interface GenerateResponse {
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
  raw?: any;
}

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  isConfigured(): boolean;
  isAvailable(): boolean;
  healthCheck(): Promise<boolean>;
  generate(request: GenerateRequest): Promise<GenerateResponse>;
  stream?(
    request: GenerateRequest,
    onChunk: (chunk: string) => void
  ): Promise<GenerateResponse>;
}

export interface ExecutionDiagnostic {
  selectedProvider: string;
  selectedModel: string;
  taskType: TaskType;
  selectionReason: string;
  latencyMs: number;
  success: boolean;
  fallbackUsed: boolean;
  attemptedProviders: string[];
  errors?: Record<string, string>;
}
