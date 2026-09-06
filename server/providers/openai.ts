import OpenAI from 'openai';
import { AIProvider, GenerateRequest, GenerateResponse, ProviderCapabilities } from '../types';
import { healthManager } from '../health';

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI (Reasoning & Coding Specialist)';
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    reasoning: true,
    coding: true,
    github: false,
    multimodal: true,
    streaming: true,
    voiceLive: false,
    fastTasks: false,
  };

  private client: OpenAI | null = null;

  constructor() {
    healthManager.registerProvider(this.id, this.name, this.isConfigured());
  }

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
  }

  isAvailable(): boolean {
    return this.isConfigured() && healthManager.canAttempt(this.id);
  }

  private getClient(): OpenAI {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    if (!this.client) {
      this.client = new OpenAI({ apiKey: key });
    }
    return this.client;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const client = this.getClient();
      const resp = await client.models.list();
      return Boolean(resp.data && resp.data.length > 0);
    } catch {
      return false;
    }
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const startTime = Date.now();
    const client = this.getClient();

    const formattedMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: request.systemInstruction },
    ];

    for (const m of request.messages.slice(-12)) {
      const role = m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user';
      formattedMessages.push({
        role,
        content: m.cleanText || m.content || '',
      });
    }

    const model = request.taskType === 'reasoning' || request.taskType === 'coding'
      ? 'gpt-4o'
      : 'gpt-4o-mini';

    try {
      const completion = await client.chat.completions.create(
        {
          model,
          messages: formattedMessages,
          response_format: request.jsonMode ? { type: 'json_object' } : undefined,
          temperature: request.temperature ?? 0.75,
          max_tokens: request.maxTokens ?? 450,
        },
        { signal: request.signal }
      );

      const text = completion.choices[0]?.message?.content || '';
      const latencyMs = Date.now() - startTime;
      healthManager.recordSuccess(this.id, latencyMs);

      return {
        text,
        provider: this.id,
        model,
        latencyMs,
        raw: completion,
      };
    } catch (err: any) {
      healthManager.recordFailure(this.id, err);
      throw err;
    }
  }

  async stream(
    request: GenerateRequest,
    onChunk: (chunk: string) => void
  ): Promise<GenerateResponse> {
    const startTime = Date.now();
    const client = this.getClient();

    const formattedMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: request.systemInstruction },
    ];

    for (const m of request.messages.slice(-12)) {
      const role = m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user';
      formattedMessages.push({
        role,
        content: m.cleanText || m.content || '',
      });
    }

    const model = 'gpt-4o-mini';

    try {
      const stream = await client.chat.completions.create(
        {
          model,
          messages: formattedMessages,
          stream: true,
          response_format: request.jsonMode ? { type: 'json_object' } : undefined,
          temperature: request.temperature ?? 0.75,
          max_tokens: request.maxTokens ?? 450,
        },
        { signal: request.signal }
      );

      let fullText = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullText += delta;
          onChunk(delta);
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
      healthManager.recordFailure(this.id, err);
      throw err;
    }
  }
}

export const openAIProvider = new OpenAIProvider();
