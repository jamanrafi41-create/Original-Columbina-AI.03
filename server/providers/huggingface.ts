import { AIProvider, GenerateRequest, GenerateResponse, ProviderCapabilities } from '../types';
import { healthManager } from '../health';

export class HuggingFaceProvider implements AIProvider {
  readonly id = 'huggingface';
  readonly name = 'Hugging Face (Specialized Task Specialist)';
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    reasoning: true,
    coding: false,
    github: false,
    multimodal: false,
    streaming: false,
    voiceLive: false,
    fastTasks: false,
  };

  private readonly baseUrl = 'https://router.huggingface.co/hf-inference/v1';

  constructor() {
    healthManager.registerProvider(this.id, this.name, this.isConfigured());
  }

  isConfigured(): boolean {
    return Boolean(
      (process.env.HUGGINGFACEHUB_API_TOKEN && process.env.HUGGINGFACEHUB_API_TOKEN.trim()) ||
      (process.env.HF_TOKEN && process.env.HF_TOKEN.trim())
    );
  }

  isAvailable(): boolean {
    return this.isConfigured() && healthManager.canAttempt(this.id);
  }

  private getToken(): string {
    return process.env.HUGGINGFACEHUB_API_TOKEN || process.env.HF_TOKEN || '';
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.getToken()}` },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok || res.status === 404; // HF router may not list all models at root
    } catch {
      return false;
    }
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const startTime = Date.now();
    const token = this.getToken();
    if (!token) throw new Error('HUGGINGFACEHUB_API_TOKEN is not configured');

    const formattedMessages = [
      { role: 'system', content: request.systemInstruction },
      ...request.messages.slice(-8).map((m) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
        content: m.cleanText || m.content || '',
      })),
    ];

    const model = 'meta-llama/Llama-3.2-3B-Instruct';

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: formattedMessages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 400,
        }),
        signal: request.signal || AbortSignal.timeout(18000),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HuggingFace returned ${res.status}: ${errText.slice(0, 200)}`);
      }

      const json = await res.json();
      const text = json.choices?.[0]?.message?.content || '';
      const latencyMs = Date.now() - startTime;
      healthManager.recordSuccess(this.id, latencyMs);

      return {
        text,
        provider: this.id,
        model,
        latencyMs,
        raw: json,
      };
    } catch (err: any) {
      healthManager.recordFailure(this.id, err);
      throw err;
    }
  }
}

export const huggingFaceProvider = new HuggingFaceProvider();
