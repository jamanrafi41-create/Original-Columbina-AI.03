/**
 * Voice Emotion Controller
 * Translates Columbina's current emotion, intensity, and voice style into
 * acoustic parameters for Fish Audio TTS, Gemini TTS, and Web Speech Synthesis.
 */

import { Emotion, ColumbinaVoiceStyle } from '../types';

export interface VoiceParameters {
  speed: number; // 0.8 - 1.3
  pitch: number; // 0.8 - 1.25
  fishExpression?: string; // [calm], [happy], [sad], [excited]
  fishVoiceDirection?: string; // (whispering), (sighing), (laughing), etc.
  audioFilterPreset?: 'ethereal' | 'intimate' | 'crisp' | 'soft';
}

export class VoiceEmotionController {
  /**
   * Generates optimal voice prosody parameters for any emotion
   */
  public static resolveVoiceParams(
    emotion: Emotion | string,
    intensity: number = 0.35,
    customStyle?: string
  ): VoiceParameters {
    const emo = (emotion || 'calm').toLowerCase();
    const style = (customStyle || '').toLowerCase();

    let speed = 0.98;
    let pitch = 1.0;
    let fishExpression = '[calm]';
    let fishVoiceDirection = '(whispering)';
    let audioFilterPreset: 'ethereal' | 'intimate' | 'crisp' | 'soft' = 'ethereal';

    switch (emo) {
      case 'happy':
      case 'joyful':
      case 'cheerful':
      case 'enthusiastic':
        speed = 1.04 + intensity * 0.04;
        pitch = 1.03 + intensity * 0.03;
        fishExpression = '[happy]';
        fishVoiceDirection = intensity > 0.6 ? '(laughing)' : '(softly)';
        audioFilterPreset = 'crisp';
        break;

      case 'excited':
        speed = 1.08 + intensity * 0.05;
        pitch = 1.06 + intensity * 0.04;
        fishExpression = '[excited]';
        fishVoiceDirection = '(laughing)';
        audioFilterPreset = 'crisp';
        break;

      case 'playful':
      case 'amused':
      case 'mischievous':
      case 'teasing':
      case 'playfully_provocative':
        speed = 1.02 + intensity * 0.02;
        pitch = 1.03;
        fishExpression = '[happy]';
        fishVoiceDirection = '(softly)';
        audioFilterPreset = 'ethereal';
        break;

      case 'curious':
      case 'interested':
        speed = 1.0;
        pitch = 1.02;
        fishExpression = '[calm]';
        fishVoiceDirection = '(softly)';
        audioFilterPreset = 'ethereal';
        break;

      case 'sad':
      case 'melancholic':
      case 'lonely':
      case 'disappointed':
        speed = Math.max(0.88, 0.94 - intensity * 0.06);
        pitch = Math.max(0.92, 0.97 - intensity * 0.04);
        fishExpression = '[sad]';
        fishVoiceDirection = '(sighing)';
        audioFilterPreset = 'soft';
        break;

      case 'worried':
      case 'concerned':
      case 'nervous':
        speed = 0.96;
        pitch = 1.02;
        fishExpression = '[sad]';
        fishVoiceDirection = '(whispering)';
        audioFilterPreset = 'soft';
        break;

      case 'caring':
      case 'comforting':
      case 'gentle':
      case 'affectionate':
      case 'warm':
        speed = 0.95;
        pitch = 0.99;
        fishExpression = '[calm]';
        fishVoiceDirection = '(whispering)';
        audioFilterPreset = 'intimate';
        break;

      case 'serious':
      case 'focused':
      case 'determined':
      case 'protective':
      case 'authoritative':
        speed = 0.96;
        pitch = 0.97;
        fishExpression = '[calm]';
        fishVoiceDirection = '';
        audioFilterPreset = 'crisp';
        break;

      case 'mysterious':
      case 'cold':
      case 'distant':
        speed = 0.93;
        pitch = 0.98;
        fishExpression = '[calm]';
        fishVoiceDirection = '(whispering)';
        audioFilterPreset = 'ethereal';
        break;

      case 'annoyed':
      case 'irritated':
      case 'frustrated':
      case 'angry':
        speed = 1.04;
        pitch = 0.96;
        fishExpression = '[angry]';
        fishVoiceDirection = '';
        audioFilterPreset = 'crisp';
        break;

      case 'surprised':
      case 'shocked':
        speed = 1.06;
        pitch = 1.08;
        fishExpression = '[excited]';
        fishVoiceDirection = '(panting)';
        audioFilterPreset = 'crisp';
        break;

      case 'sleepy':
      case 'relaxed':
        speed = 0.90;
        pitch = 0.96;
        fishExpression = '[calm]';
        fishVoiceDirection = '(whispering)';
        audioFilterPreset = 'soft';
        break;

      case 'neutral':
      case 'calm':
      default:
        speed = 0.97;
        pitch = 1.0;
        fishExpression = '[calm]';
        fishVoiceDirection = '(whispering)';
        audioFilterPreset = 'ethereal';
        break;
    }

    // Override or refine based on explicit voiceStyle
    if (style.includes('whisper')) {
      fishVoiceDirection = '(whispering)';
      speed = Math.min(speed, 0.94);
    } else if (style.includes('laugh')) {
      fishVoiceDirection = '(laughing)';
    } else if (style.includes('sigh')) {
      fishVoiceDirection = '(sighing)';
    }

    return {
      speed: Number(speed.toFixed(2)),
      pitch: Number(pitch.toFixed(2)),
      fishExpression,
      fishVoiceDirection,
      audioFilterPreset,
    };
  }
}
