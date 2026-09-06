import { AIProvider, GenerateRequest, GenerateResponse, ProviderCapabilities } from '../types';
import { healthManager } from '../health';

export class OpenRouterProvider implements AIProvider {
  readonly id = 'openrouter';
  readonly name = 'OpenRouter (Multi-Model Gateway)';
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    reasoning: true,
    coding: true,
    github: false,
    multimodal: true,
    streaming: true,
    voiceLive: false,
    fastTasks: true,
  };

  private readonly baseUrl = 'https://openrouter.ai/api/v1';
  private cachedModels: string[] = [];
  private lastModelFetch: number = 0;

  constructor() {
    healthManager.registerProvider(this.id, this.name, this.isConfigured());
  }

  isConfigured(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim());
  }

  isAvailable(): boolean {
    return this.isConfigured() && healthManager.canAttempt(this.id);
  }

  private async getAvailableModels(): Promise<string[]> {
    const now = Date.now();
    // Cache for 10 minutes
    if (this.cachedModels.length > 0 && now - this.lastModelFetch < 600_000) {
      return this.cachedModels;
    }

    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const data = await res.json();
        const allModels = (data.data || []).map((m: any) => m.id as string);

        // Filter and sort: Prioritize free models, then top reliable models
        const freeModels = allModels.filter((id: string) => id.includes(':free'));
        const preferredModels = [
          ...freeModels,
          'meta-llama/llama-3.3-70b-instruct',
          'google/gemini-2.0-flash-001',
          'mistralai/mistral-small-24b-instruct-2501',
          'qwen/qwen-2.5-72b-instruct',
        ].filter((id) => allModels.includes(id) || id.includes(':free'));

        this.cachedModels = preferredModels.length > 0 ? preferredModels : allModels.slice(0, 10);
        this.lastModelFetch = now;
        return this.cachedModels;
      }
    } catch (e) {
      console.warn('[OpenRouterProvider] Model listing fetch failed, using fallback list');
    }

    // Fallback known resilient models
    return [
      'openrouter/free',
      'google/gemma-4-31b-it:free',
      'nvidia/nemotron-3.5-lightning:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'meta-llama/llama-3.3-70b-instruct',
    ];
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const models = await this.getAvailableModels();
      return models.length > 0;
    } catch {
      return false;
    }
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const startTime = Date.now();
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY is not configured');

    const availableModels = await this.getAvailableModels();
    const selectedModel = availableModels[0] || 'meta-llama/llama-3.3-70b-instruct:free';

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


    const formatsToTry = request.jsonMode ? [{ type: 'json_object' }, undefined] : [undefined];
    let lastError: any = null;

    for (const response_format of formatsToTry) {
      try {
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ai.studio/build',
            'X-Title': 'Columbina AI Assistant',
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: formattedMessages,
            response_format,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 500,
          }),
          signal: request.signal || AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          const errText = await res.text();
          if (res.status === 400 && response_format) {
            console.warn(`[OpenRouterProvider] 400 with response_format on ${selectedModel}, retrying without...`);
            continue;
          }
          throw new Error(`OpenRouter returned ${res.status}: ${errText.slice(0, 200)}`);
        }

        const json = await res.json();
        const text = json.choices?.[0]?.message?.content || '';
        const latencyMs = Date.now() - startTime;
        healthManager.recordSuccess(this.id, latencyMs);

        return {
          text,
          provider: this.id,
          model: selectedModel,
          latencyMs,
          raw: json,
        };
      } catch (err: any) {
        lastError = err;
      }
    }

    healthManager.recordFailure(this.id, lastError);
    throw lastError || new Error('OpenRouter failed to generate content');
  }

  async stream(
    request: GenerateRequest,
    onChunk: (chunk: string) => void
  ): Promise<GenerateResponse> {
    const startTime = Date.now();
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY is not configured');

    const availableModels = await this.getAvailableModels();
    const selectedModel = availableModels[0] || 'meta-llama/llama-3.3-70b-instruct:free';

    const formattedMessages = [
      { role: 'system', content: request.systemInstruction },
      ...request.messages.slice(-10).map((m) => ({
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
          'HTTP-Referer': 'https://ai.studio/build',
          'X-Title': 'Columbina AI Assistant',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: formattedMessages,
          stream: true,
          response_format: request.jsonMode ? { type: 'json_object' } : undefined,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 500,
        }),
        signal: request.signal || AbortSignal.timeout(18000),
      });

      if (!res.ok || !res.body) {
        throw new Error(`OpenRouter streaming failed with status ${res.status}`);
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
        model: selectedModel,
        latencyMs,
      };
    } catch (err: any) {
      healthManager.recordFailure(this.id, err);
      throw err;
    }
  }
}

export const openRouterProvider = new OpenRouterProvider();
