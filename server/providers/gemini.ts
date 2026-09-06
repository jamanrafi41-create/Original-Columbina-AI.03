import { GoogleGenAI } from '@google/genai';
import { AIProvider, GenerateRequest, GenerateResponse, ProviderCapabilities } from '../types';
import { healthManager } from '../health';

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini (Primary Brain)';
  readonly capabilities: ProviderCapabilities = {
    chat: true,
    reasoning: true,
    coding: true,
    github: false,
    multimodal: true,
    streaming: true,
    voiceLive: true,
    fastTasks: true,
  };

  private client: GoogleGenAI | null = null;

  constructor() {
    healthManager.registerProvider(this.id, this.name, this.isConfigured());
  }

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
  }

  isAvailable(): boolean {
    return this.isConfigured() && healthManager.canAttempt(this.id);
  }

  private getClient(): GoogleGenAI {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    if (!this.client) {
      this.client = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build-gemini',
          },
        },
      });
    }
    return this.client;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const client = this.getClient();
      const resp = await client.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [{ parts: [{ text: 'ping' }] }],
      });
      return Boolean(resp.text);
    } catch {
      return false;
    }
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const startTime = Date.now();
    const client = this.getClient();

    // Map conversation turns for Gemini
    const contents = request.messages.slice(-12).map((m) => {
      const parts: any[] = [];
      if (m.image) {
        let mimeType = 'image/jpeg';
        let base64Data = m.image;
        if (m.image.startsWith('data:')) {
          const split = m.image.split(';base64,');
          mimeType = split[0].replace('data:', '');
          base64Data = split[1];
        }
        parts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
      }
      if (m.cleanText || m.content) {
        parts.push({ text: m.cleanText || m.content });
      }
      return {
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts,
      };
    });

    // Prefer ultra-fast, resilient modern Gemini models (lite first for high availability)
    const candidateModels = ['gemini-3.8-flash'];
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const response = await client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: request.systemInstruction,
            temperature: request.temperature ?? 0.75,
            responseMimeType: request.jsonMode ? 'application/json' : undefined,
          },
        });

        const text = response.text || '';
        if (text) {
          const latencyMs = Date.now() - startTime;
          healthManager.recordSuccess(this.id, latencyMs);
          return {
            text,
            provider: this.id,
            model,
            latencyMs,
            raw: response,
          };
        }
      } catch (err: any) {
        lastError = err;
        const status = err?.status || err?.code || '';
        // If 503 (high demand) or rate limited, quietly attempt the next candidate model
        if (status === 503 || status === 429) {
          console.warn(`[GeminiProvider] Model ${model} unavailable (${status}), trying next candidate...`);
        } else {
          console.warn(`[GeminiProvider] Model ${model} error:`, err?.message || err);
        }
      }
    }

    healthManager.recordFailure(this.id, lastError);
    throw lastError || new Error('Gemini failed to generate content');
  }

  async stream(
    request: GenerateRequest,
    onChunk: (chunk: string) => void
  ): Promise<GenerateResponse> {
    const startTime = Date.now();
    const client = this.getClient();

    const contents = request.messages.slice(-12).map((m) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.cleanText || m.content }],
    }));

    const candidateModels = request.taskType === 'reasoning'
      ? ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.1-pro-preview']
      : ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];

    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const responseStream = await client.models.generateContentStream({
          model,
          contents,
          config: {
            systemInstruction: request.systemInstruction,
            temperature: request.temperature ?? 0.75,
            responseMimeType: request.jsonMode ? 'application/json' : undefined,
          },
        });

        let fullText = '';
        for await (const chunk of responseStream) {
          const textPart = chunk.text || '';
          if (textPart) {
            fullText += textPart;
            onChunk(textPart);
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
        const status = err?.status || err?.code || '';
        if (status === 503 || status === 429) {
          console.warn(`[GeminiProvider] Stream model ${model} unavailable (${status}), trying next candidate...`);
        } else {
          console.warn(`[GeminiProvider] Stream model ${model} error:`, err?.message || err);
        }
      }
    }

    healthManager.recordFailure(this.id, lastError);
    throw lastError || new Error('Gemini streaming failed to generate content');
  }
}

export const geminiProvider = new GeminiProvider();
