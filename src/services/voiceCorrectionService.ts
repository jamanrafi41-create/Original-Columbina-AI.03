/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { cleanFinalTranscript, isNoiseTranscript } from '../utils/speechDeduplicator';
import { ChatMessage } from '../types';

export interface VoiceCorrectionResult {
  isNoise: boolean;
  correctedText: string;
  confidence: number;
  needsClarification: boolean;
  clarificationText?: string;
}

class VoiceCorrectionService {
  /**
   * Cleans and validates speech-to-text transcript while strictly preserving the exact
   * words, vocabulary, slang, numbers, technical terms, and meaning spoken by the user.
   */
  public async correctTranscript(
    rawTranscript: string,
    _language = 'en-US',
    _recentMessages: ChatMessage[] = []
  ): Promise<VoiceCorrectionResult> {
    const trimmed = (rawTranscript || '').trim();

    // 1. Noise and accidental acoustic artifact check
    if (isNoiseTranscript(trimmed)) {
      return {
        isNoise: true,
        correctedText: '',
        confidence: 0,
        needsClarification: false,
      };
    }

    // 2. Format with clean punctuation and name casing, preserving every user word
    const cleanText = cleanFinalTranscript(trimmed);

    return {
      isNoise: false,
      correctedText: cleanText,
      confidence: 0.98,
      needsClarification: false,
    };
  }
}

export const voiceCorrectionService = new VoiceCorrectionService();

