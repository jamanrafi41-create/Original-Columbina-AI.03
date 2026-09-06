/**
 * VRM Action & Gesture Controller
 * Safely and deterministically maps Columbina's action and gesture metadata to
 * humanoid bone transform offsets (head tilt, leaning, chest touch, graceful gestures, sway).
 * Ensures smooth kinematics, camera-facing posture, and graceful fallback for any unknown action.
 */

import { ColumbinaAction } from '../types';

export interface HumanoidBoneOffsets {
  head?: { x: number; y: number; z: number };
  neck?: { x: number; y: number; z: number };
  spine?: { x: number; y: number; z: number };
  chest?: { x: number; y: number; z: number };
  leftUpperArm?: { x: number; y: number; z: number };
  rightUpperArm?: { x: number; y: number; z: number };
  leftLowerArm?: { x: number; y: number; z: number };
  rightLowerArm?: { x: number; y: number; z: number };
  leftHand?: { x: number; y: number; z: number };
  rightHand?: { x: number; y: number; z: number };
  leanZ?: number;
  swayAmount?: number;
}

export class VRMActionController {
  private static readonly VALID_ACTIONS: Set<string> = new Set([
    'idle',
    'look_at_user',
    'small_head_tilt',
    'slow_blink',
    'blink',
    'smile',
    'soft_smile',
    'small_laugh',
    'giggle',
    'look_curious',
    'lean_forward',
    'lean_backward',
    'nod',
    'small_shake_of_head',
    'look_surprised',
    'look_concerned',
    'look_confused',
    'look_embarrassed',
    'look_away_briefly',
    'look_down_briefly',
    'close_eyes_calmly',
    'hand_gesture',
    'small_wave',
    'raise_hand',
    'point',
    'open_palm_gesture',
    'touch_chest',
    'cross_arms',
    'rest_hands_naturally',
    'small_shoulder_movement',
    'gentle_breathing',
    'subtle_sway',
    'thoughtful_pose',
    'serious_posture',
    'protective_posture',
    'playful_gesture',
    'teasing_gesture',
    'excited_gesture',
    'surprised_reaction',
    'concerned_reaction',
    'comforting_gesture',
    'greeting',
    'farewell',
    'talking',
  ]);

  /**
   * Normalize and validate action names, safely falling back to closest supported action
   */
  public static normalizeAction(rawAction?: string): ColumbinaAction {
    if (!rawAction) return 'idle';
    const clean = rawAction.toLowerCase().trim().replace(/[\s-]+/g, '_') as ColumbinaAction;
    if (this.VALID_ACTIONS.has(clean)) {
      return clean;
    }
    // Heuristic fallbacks
    if (clean.includes('tilt') || clean.includes('head')) return 'small_head_tilt';
    if (clean.includes('lean') || clean.includes('forward')) return 'lean_forward';
    if (clean.includes('chest') || clean.includes('heart')) return 'touch_chest';
    if (clean.includes('thought') || clean.includes('think')) return 'thoughtful_pose';
    if (clean.includes('wave') || clean.includes('greet')) return 'small_wave';
    if (clean.includes('curious')) return 'look_curious';
    if (clean.includes('playful') || clean.includes('teas')) return 'playful_gesture';
    if (clean.includes('nod')) return 'nod';
    return 'idle';
  }

  /**
   * Generates procedural humanoid bone transform offsets for a given action and phase
   */
  public static getActionOffsets(
    action: ColumbinaAction | string,
    intensity: number = 0.35,
    time: number = 0
  ): HumanoidBoneOffsets {
    const act = this.normalizeAction(action);
    const weight = Math.max(0.15, Math.min(1.0, intensity));

    switch (act) {
      case 'small_head_tilt':
      case 'look_curious':
        return {
          head: { x: 0.02, y: 0.03 * weight, z: 0.12 * weight },
          neck: { x: 0.01, y: 0.02 * weight, z: 0.05 * weight },
          leanZ: 0.02 * weight,
        };

      case 'lean_forward':
        return {
          spine: { x: 0.07 * weight, y: 0, z: 0 },
          chest: { x: 0.06 * weight, y: 0, z: 0 },
          head: { x: -0.05 * weight, y: 0, z: 0 },
          leanZ: 0.08 * weight,
        };

      case 'lean_backward':
        return {
          spine: { x: -0.05 * weight, y: 0, z: 0 },
          head: { x: 0.04 * weight, y: 0, z: 0 },
          leanZ: -0.04 * weight,
        };

      case 'touch_chest':
      case 'comforting_gesture':
        return {
          rightUpperArm: { x: 0.65 * weight, y: -0.4 * weight, z: 0.35 * weight },
          rightLowerArm: { x: 0.95 * weight, y: -0.2 * weight, z: 0.1 },
          rightHand: { x: 0.25 * weight, y: -0.15, z: 0.1 },
          head: { x: 0.04 * weight, y: 0.02, z: 0.04 * weight },
          chest: { x: 0.02, y: 0, z: 0 },
        };

      case 'thoughtful_pose':
        return {
          rightUpperArm: { x: 0.8 * weight, y: -0.35 * weight, z: 0.25 * weight },
          rightLowerArm: { x: 1.15 * weight, y: -0.1, z: 0 },
          rightHand: { x: 0.3 * weight, y: 0, z: 0.2 },
          head: { x: 0.08 * weight, y: 0.06 * weight, z: 0.08 * weight },
        };

      case 'hand_gesture':
      case 'open_palm_gesture':
      case 'playful_gesture':
      case 'teasing_gesture':
        return {
          rightUpperArm: { x: 0.45 * weight, y: -0.2 * weight, z: 0.4 * weight },
          rightLowerArm: { x: 0.65 * weight, y: 0, z: 0.1 },
          rightHand: { x: 0.15 * weight, y: -0.1, z: 0.05 },
          head: { x: 0.02, y: -0.03 * weight, z: 0.06 * weight },
          chest: { x: 0.02 * weight, y: 0, z: 0 },
        };

      case 'small_wave':
      case 'greeting':
        return {
          rightUpperArm: { x: 0.75 * weight, y: -0.25 * weight, z: 0.7 * weight },
          rightLowerArm: { x: 0.85 * weight, y: 0, z: 0.2 },
          rightHand: { x: 0, y: Math.sin(time * 6) * 0.2 * weight, z: 0 },
          head: { x: 0.02, y: 0, z: 0.04 * weight },
        };

      case 'nod':
        return {
          head: { x: Math.sin(time * 4) * 0.12 * weight, y: 0, z: 0 },
          neck: { x: Math.sin(time * 4) * 0.04 * weight, y: 0, z: 0 },
        };

      case 'small_shake_of_head':
        return {
          head: { x: 0, y: Math.sin(time * 4) * 0.1 * weight, z: 0 },
        };

      case 'look_away_briefly':
        return {
          head: { x: -0.02, y: 0.18 * weight, z: 0.04 * weight },
          neck: { x: 0, y: 0.06 * weight, z: 0 },
        };

      case 'look_down_briefly':
        return {
          head: { x: 0.16 * weight, y: 0.02, z: 0.02 },
          neck: { x: 0.05 * weight, y: 0, z: 0 },
        };

      case 'serious_posture':
      case 'protective_posture':
        return {
          spine: { x: -0.03 * weight, y: 0, z: 0 },
          chest: { x: -0.04 * weight, y: 0, z: 0 },
          head: { x: 0.02, y: 0, z: 0 },
        };

      case 'cross_arms':
        return {
          leftUpperArm: { x: 0.65 * weight, y: 0.3 * weight, z: -0.3 * weight },
          leftLowerArm: { x: 1.1 * weight, y: 0.2, z: 0 },
          rightUpperArm: { x: 0.65 * weight, y: -0.3 * weight, z: 0.3 * weight },
          rightLowerArm: { x: 1.1 * weight, y: -0.2, z: 0 },
          chest: { x: 0.03 * weight, y: 0, z: 0 },
        };

      case 'subtle_sway':
      case 'idle':
      default:
        return {
          swayAmount: 1.0,
        };
    }
  }
}
