import { AIProvider, GenerateRequest, GenerateResponse, ProviderCapabilities } from '../types';
import { healthManager } from '../health';

export class GroqProvider implements AIProvider {
  readonly id = 'groq';
  readonly name = 'Groq (Ultra-Fast Speed Specialist)';
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    reasoning: true,
    coding: true,
    github: false,
    multimodal: false,
    streaming: true,
    voiceLive: false,
    fastTasks: true,
  };

  private readonly baseUrl = 'https://api.groq.com/openai/v1';
  private cachedModels: string[] = [];
  private lastModelFetchTime = 0;

  constructor() {
    healthManager.registerProvider(this.id, this.name, this.isConfigured());
  }

  isConfigured(): boolean {
    return Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim());
  }

  isAvailable(): boolean {
    return this.isConfigured() && healthManager.canAttempt(this.id);
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async getAvailableModels(key: string): Promise<string[]> {
    const now = Date.now();
    if (this.cachedModels.length > 0 && now - this.lastModelFetchTime < 300000) {
      return this.cachedModels;
    }
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${key}`,
        },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.data)) {
          const ids = data.data.map((m: any) => m.id as string).filter(Boolean);
          if (ids.length > 0) {
            this.cachedModels = ids;
            this.lastModelFetchTime = now;
            return ids;
          }
        }
      }
    } catch {}
    return [];
  }

  private async resolveCandidateModels(key: string, isFastTask: boolean): Promise<string[]> {
    const available = await this.getAvailableModels(key);
    const preferredPriority = isFastTask
      ? [
          'llama-3.1-8b-instant',
          'llama-3.1-70b-versatile',
          'llama3-8b-8192',
          'llama-3.3-70b-versatile',
          'gemma2-9b-it',
        ]
      : [
          'llama-3.1-8b-instant',
          'llama-3.1-70b-versatile',
          'llama-3.3-70b-versatile',
          'llama3-70b-8192',
          'llama3-8b-8192',
          'mixtral-8x7b-32768',
        ];

    if (available.length > 0) {
      const matched = preferredPriority.filter((p) => available.includes(p));
      if (matched.length > 0) {
        return matched;
      }
      // If none of our preferred list matched, return any text chat model from available
      const chatModels = available.filter((id) => !id.includes('whisper') && !id.includes('vision') && !id.includes('embed'));
      if (chatModels.length > 0) {
        return chatModels;
      }
    }

    return ['llama-3.1-8b-instant', 'llama-3.1-70b-versatile', 'llama3-8b-8192', 'llama3-70b-8192'];
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const startTime = Date.now();
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY is not configured');

    let systemInstruction = request.systemInstruction || '';
    if (request.jsonMode && !systemInstruction.toLowerCase().includes('json')) {
      systemInstruction += '\n\nIMPORTANT: Respond in valid JSON format.';
    }

    const formattedMessages = [
      { role: 'system', content: systemInstruction },
      ...request.messages.slice(-10).map((m) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
        content: m.cleanText || m.content || '',
      })),
    ];

    const candidateModels = await this.resolveCandidateModels(key, request.taskType === 'fast');
    let lastError: any = null;

    for (const model of candidateModels) {
      // First attempt with response_format if jsonMode is requested, then fallback without
      const formatsToTry = request.jsonMode ? [{ type: 'json_object' }, undefined] : [undefined];

      for (const response_format of formatsToTry) {
        try {
          const res = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: formattedMessages,
              response_format,
              temperature: request.temperature ?? 0.7,
              max_tokens: request.maxTokens ?? 500,
            }),
            signal: request.signal || AbortSignal.timeout(12000),
          });

          if (!res.ok) {
            const errText = await res.text();
            if (res.status === 404 || errText.includes('model_not_found')) {
              // Model does not exist, move directly to next candidate model
              lastError = new Error(`Groq model ${model} not available: ${errText.slice(0, 150)}`);
              break;
            }
            // If it failed because of json validation, continue to try without response_format silently
            if (res.status === 400 && response_format && errText.includes('json_validate_failed')) {
              continue;
            }
            throw new Error(`Groq API returned ${res.status}: ${errText.slice(0, 200)}`);
          }


          const json = await res.json();
          const text = json.choices?.[0]?.message?.content || '';
          if (text) {
            const latencyMs = Date.now() - startTime;
            healthManager.recordSuccess(this.id, latencyMs);

            return {
              text,
              provider: this.id,
              model,
              latencyMs,
              raw: json,
            };
          }
        } catch (err: any) {
          lastError = err;
        }
      }
    }

    healthManager.recordFailure(this.id, lastError);
    throw lastError || new Error('Groq failed to generate content');
  }

  async stream(
    request: GenerateRequest,
    onChunk: (chunk: string) => void
  ): Promise<GenerateResponse> {
    const startTime = Date.now();
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY is not configured');

    const formattedMessages = [
      { role: 'system', content: request.systemInstruction },
      ...request.messages.slice(-10).map((m) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
        content: m.cleanText || m.content || '',
      })),
    ];

    const candidateModels = await this.resolveCandidateModels(key, true);
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: formattedMessages,
            stream: true,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 500,
          }),
          signal: request.signal || AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          const errText = await res.text();
          if (res.status === 404 || errText.includes('model_not_found')) {
            lastError = new Error(`Groq model ${model} not available: ${errText.slice(0, 150)}`);
            continue;
          }
          throw new Error(`Groq streaming failed with status ${res.status}: ${errText.slice(0, 150)}`);
        }

        if (!res.body) {
          throw new Error(`Groq response body is null`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.slice(6));
                const delta = data.choices?.[0]?.delta?.content || '';
                if (delta) {
                  fullText += delta;
                  onChunk(delta);
                }
              } catch {}
            }
          }
        }

        const latencyMs = Date.now() - startTime;
        healthManager.recordSuccess(this.id, latencyMs);
        return {
          text: fullText,
          provider: this.id,
          model,
          latencyMs,
        };
      } catch (err: any) {
        lastError = err;
      }
    }

    healthManager.recordFailure(this.id, lastError);
    throw lastError || new Error('Groq streaming failed');
  }
}

export const groqProvider = new GroqProvider();

