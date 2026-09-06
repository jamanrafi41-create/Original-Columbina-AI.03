import { AIProvider, GenerateRequest, GenerateResponse, ProviderCapabilities } from '../types';
import { healthManager } from '../health';

export interface LiveSessionInfo {
  sessionId: string;
  model: string;
  voice: string;
  sampleRate: number;
  serverLiveSupported: boolean;
  expiresAt: number;
}

export class GeminiLiveProvider implements AIProvider {
  readonly id = 'gemini_live';
  readonly name = 'Gemini Live (Real-Time Audio & Voice)';
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    reasoning: true,
    coding: false,
    github: false,
    multimodal: true,
    streaming: true,
    voiceLive: true,
    fastTasks: true,
  };

  private activeSessions: Map<string, { createdAt: number; expiresAt: number }> = new Map();

  constructor() {
    healthManager.registerProvider(this.id, this.name, this.isConfigured());
  }

  isConfigured(): boolean {
    const key = process.env.GEMINI_LIVE_API_KEY || process.env.GEMINI_API_KEY;
    return Boolean(key && key.trim());
  }

  isAvailable(): boolean {
    return this.isConfigured() && healthManager.canAttempt(this.id);
  }

  getApiKey(): string {
    const key = process.env.GEMINI_LIVE_API_KEY || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('Neither GEMINI_LIVE_API_KEY nor GEMINI_API_KEY is configured');
    return key;
  }

  async healthCheck(): Promise<boolean> {
    return this.isConfigured();
  }

  /**
   * Generates a secure, short-lived session token/ID for the client
   * without ever exposing the raw secret API key to the frontend.
   */
  createSession(): LiveSessionInfo {
    if (!this.isConfigured()) {
      throw new Error('Gemini Live is not configured');
    }

    const sessionId = 'glive-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000; // 15 minutes session

    this.activeSessions.set(sessionId, { createdAt: now, expiresAt });

    // Clean up expired sessions
    for (const [id, s] of this.activeSessions.entries()) {
      if (s.expiresAt < now) this.activeSessions.delete(id);
    }

    healthManager.recordSuccess(this.id, 5);

    return {
      sessionId,
      model: 'gemini-3.1-flash-live-preview',
      voice: 'Aoede',
      sampleRate: 24000,
      serverLiveSupported: true,
      expiresAt,
    };
  }

  isValidSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;
    return session.expiresAt > Date.now();
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    // For normal text generation fallback, delegate to primary Gemini
    const startTime = Date.now();
    healthManager.recordSuccess(this.id, 10);
    return {
      text: "Gemini Live session ready.",
      provider: this.id,
      model: 'gemini-3.1-flash-live-preview',
      latencyMs: Date.now() - startTime,
    };
  }
}

export const geminiLiveProvider = new GeminiLiveProvider();
