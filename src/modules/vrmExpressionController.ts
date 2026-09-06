/**
 * VRM Expression Controller
 * Maps Columbina's emotions, facial expressions, and intensity to VRM blendshape targets.
 * Ensures natural facial kinematics, asymmetric micro-expressions, and safe morph clamping.
 */

import { Emotion, ColumbinaFacialExpression } from '../types';

export interface VRMBlendshapeWeights {
  happy: number;
  angry: number;
  sad: number;
  relaxed: number;
  surprised: number;
  neutral: number;
  blink: number;
  blinkLeft: number;
  blinkRight: number;
  lookUp?: number;
  lookDown?: number;
}

export class VRMExpressionController {
  /**
   * Computes target morph weights for VRM blendshapes based on emotion and intensity.
   */
  public static computeExpressionWeights(
    emotion: Emotion | string,
    facialExpression?: ColumbinaFacialExpression | string,
    intensity: number = 0.35,
    blinkValue: number = 0
  ): VRMBlendshapeWeights {
    const emo = (emotion || 'calm').toLowerCase();
    const face = (facialExpression || '').toLowerCase();
    const clampedIntensity = Math.max(0.1, Math.min(1.0, intensity));

    // Base default weights
    const weights: VRMBlendshapeWeights = {
      happy: 0,
      angry: 0,
      sad: 0,
      relaxed: 0,
      surprised: 0,
      neutral: 0.1,
      blink: blinkValue,
      blinkLeft: 0,
      blinkRight: 0,
    };

    // 1. Primary Mapping from facialExpression if explicitly given
    if (face === 'soft_smile' || face === 'happy') {
      weights.happy = Math.min(0.8, clampedIntensity * 0.75);
      weights.relaxed = 0.2;
    } else if (face === 'teasing' || face === 'playful' || face === 'mischievous') {
      weights.happy = Math.min(0.65, clampedIntensity * 0.7);
      weights.relaxed = 0.35;
      weights.blinkRight = clampedIntensity > 0.6 ? 0.3 : 0; // playful wink/squint
    } else if (face === 'curious' || face === 'thoughtful') {
      weights.relaxed = 0.3;
      weights.surprised = Math.min(0.25, clampedIntensity * 0.3);
    } else if (face === 'concerned' || face === 'sad') {
      weights.sad = Math.min(0.7, clampedIntensity * 0.8);
      weights.relaxed = 0.1;
    } else if (face === 'surprised') {
      weights.surprised = Math.min(0.75, clampedIntensity * 0.85);
    } else if (face === 'angry' || face === 'cold') {
      weights.angry = Math.min(0.6, clampedIntensity * 0.7);
      weights.neutral = 0.4;
    } else if (face === 'mysterious') {
      weights.relaxed = 0.4;
      weights.happy = 0.15;
    }
    // 2. Emotion Fallback mapping
    else {
      switch (emo) {
        case 'happy':
        case 'joyful':
        case 'cheerful':
        case 'excited':
          weights.happy = Math.min(0.85, clampedIntensity * 0.8);
          weights.relaxed = 0.2;
          break;

        case 'playful':
        case 'amused':
        case 'teasing':
        case 'mischievous':
        case 'wink':
          weights.happy = Math.min(0.65, clampedIntensity * 0.7);
          weights.relaxed = 0.3;
          if (emo === 'wink') {
            weights.blinkRight = 0.9;
          }
          break;

        case 'curious':
        case 'interested':
          weights.relaxed = 0.35;
          weights.surprised = Math.min(0.2, clampedIntensity * 0.25);
          break;

        case 'sad':
        case 'melancholic':
        case 'lonely':
        case 'disappointed':
          weights.sad = Math.min(0.75, clampedIntensity * 0.8);
          break;

        case 'worried':
        case 'concerned':
        case 'nervous':
          weights.sad = Math.min(0.5, clampedIntensity * 0.6);
          weights.surprised = 0.1;
          break;

        case 'caring':
        case 'comforting':
        case 'gentle':
        case 'affectionate':
        case 'warm':
          weights.happy = Math.min(0.4, clampedIntensity * 0.5);
          weights.relaxed = 0.45;
          break;

        case 'serious':
        case 'focused':
        case 'determined':
        case 'protective':
          weights.neutral = 0.7;
          weights.angry = Math.min(0.2, clampedIntensity * 0.25);
          break;

        case 'mysterious':
        case 'cold':
        case 'distant':
          weights.relaxed = 0.35;
          weights.neutral = 0.4;
          break;

        case 'annoyed':
        case 'irritated':
        case 'frustrated':
        case 'angry':
          weights.angry = Math.min(0.7, clampedIntensity * 0.75);
          break;

        case 'surprised':
        case 'shocked':
          weights.surprised = Math.min(0.8, clampedIntensity * 0.85);
          break;

        case 'sleepy':
        case 'relaxed':
          weights.relaxed = 0.7;
          weights.blink = Math.max(blinkValue, 0.4);
          break;

        case 'neutral':
        case 'calm':
        default:
          weights.neutral = 0.3;
          weights.relaxed = 0.3;
          break;
      }
    }

    // Keep blink intact for natural eye blinking
    if (blinkValue > 0) {
      weights.blink = Math.max(weights.blink, blinkValue);
    }

    return weights;
  }
}
