import { AIProvider, GenerateRequest, GenerateResponse, ProviderCapabilities } from '../types';
import { healthManager } from '../health';

export class OpenCodeProvider implements AIProvider {
  readonly id = 'opencode';
  readonly name = 'OpenCode (Code & Dev Specialist)';
  readonly capabilities: ProviderCapabilities = {
    chat: false,
    reasoning: true,
    coding: true,
    github: false,
    multimodal: false,
    streaming: true,
    voiceLive: false,
    fastTasks: false,
  };

  private readonly baseUrl = process.env.OPENCODE_BASE_URL || 'https://api.opencode.ai/v1';

  constructor() {
    healthManager.registerProvider(this.id, this.name, this.isConfigured());
  }

  isConfigured(): boolean {
    return Boolean(process.env.OPENCODE_API_KEY && process.env.OPENCODE_API_KEY.trim());
  }

  isAvailable(): boolean {
    return this.isConfigured() && healthManager.canAttempt(this.id);
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${process.env.OPENCODE_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const startTime = Date.now();
    const key = process.env.OPENCODE_API_KEY;
    if (!key) throw new Error('OPENCODE_API_KEY is not configured');

    const formattedMessages = [
      { role: 'system', content: request.systemInstruction },
      ...request.messages.slice(-8).map((m) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
        content: m.cleanText || m.content || '',
      })),
    ];

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'opencode-default',
          messages: formattedMessages,
          temperature: request.temperature ?? 0.5,
          max_tokens: request.maxTokens ?? 600,
        }),
        signal: request.signal || AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenCode returned ${res.status}: ${text.slice(0, 150)}`);
      }

      const json = await res.json();
      const text = json.choices?.[0]?.message?.content || '';
      const latencyMs = Date.now() - startTime;
      healthManager.recordSuccess(this.id, latencyMs);

      return {
        text,
        provider: this.id,
        model: 'opencode-default',
        latencyMs,
      };
    } catch (err: any) {
      healthManager.recordFailure(this.id, err);
      throw err;
    }
  }
}

export const openCodeProvider = new OpenCodeProvider();
