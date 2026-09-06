/**
 * VRM Body Expression & Subtle Natural Body Language Engine for Columbina
 *
 * ARCHITECTURAL PRINCIPLES:
 * 1. LIVING NATURAL IDLE (85–90% of the time):
 *    - Arms hanging naturally with ~17° torso clearance.
 *    - Resting elbow flexion (~12° bend), never locked straight or glued to hips.
 *    - Organic breathing harmonics create realistic secondary motion in shoulders, chest, and arms.
 *    - Slow non-repeating weight shifts and subtle finger micro-articulations prevent frozen mannequin appearance.
 *
 * 2. SUBTLE NATURAL BODY LANGUAGE:
 *    - Gestures are small, unconscious, and human-like (slight wrist, subtle forearm, tiny open palm).
 *    - Speech does NOT automatically trigger hand movement — talking happens with mouth & subtle head cadence.
 *    - Gestures occur only for clear emphasis or explicit intentions, at most ONE small gesture per thought.
 *    - Natural asymmetry: one hand makes a subtle gesture while the other stays relaxed in living idle.
 *    - 3-phase smooth kinematic envelope with guaranteed, seamless return to living idle.
 *    - Emotion dynamically modulates gesture size (amplitude) and speed.
 */

import { Emotion, ColumbinaAction, ColumbinaFacialExpression } from '../types';

export type BoneRotation = [number, number, number];

export interface FingerTransforms {
  metacarpal?: BoneRotation;
  proximal?: BoneRotation;
  intermediate?: BoneRotation;
  distal?: BoneRotation;
}

export interface HandFingerSet {
  thumb?: FingerTransforms;
  index?: FingerTransforms;
  middle?: FingerTransforms;
  ring?: FingerTransforms;
  little?: FingerTransforms;
}

export interface BodyExpressionPose {
  hips?: BoneRotation;
  spine?: BoneRotation;
  chest?: BoneRotation;
  upperChest?: BoneRotation;
  neck?: BoneRotation;
  head?: BoneRotation;
  leftShoulder?: BoneRotation;
  rightShoulder?: BoneRotation;
  leftUpperArm?: BoneRotation;
  leftLowerArm?: BoneRotation;
  leftHand?: BoneRotation;
  rightUpperArm?: BoneRotation;
  rightLowerArm?: BoneRotation;
  rightHand?: BoneRotation;
  leftUpperLeg?: BoneRotation;
  rightUpperLeg?: BoneRotation;
  leftFingers?: HandFingerSet;
  rightFingers?: HandFingerSet;
  mouthScale?: number;
  mouthEmotionMod?: {
    happyAdd?: number;
    sadAdd?: number;
    surprisedAdd?: number;
  };
}

export type SubtleGestureType =
  | 'idle'
  | 'small_open_palm'
  | 'small_explain'
  | 'small_point'
  | 'touch_chest'
  | 'small_wait'
  | 'small_unsure'
  | 'small_hesitant'
  | 'thoughtful_pose'
  | 'small_wave'
  | 'small_head_tilt'
  | 'small_nod'
  | 'surprised_reaction'
  | 'comforting_gesture';

export interface ActiveGestureState {
  action: ColumbinaAction | SubtleGestureType;
  startTime: number;
  duration: number;
  hand: 'left' | 'right';
  intensity: number;
}

export interface EmotionDynamics {
  amplitude: number;
  speed: number;
  headPitchBias: number;
  headRollBias: number;
}

export class VRMBodyExpressionController {
  // Natural resting hand curvature (fingers gently curled in living relaxed posture)
  public static readonly NATURAL_IDLE_FINGERS: HandFingerSet = {
    thumb: {
      proximal: [0.08, 0.04, 0.05],
      distal: [0.10, 0, 0.02],
    },
    index: {
      proximal: [0.18, 0, 0.03],
      intermediate: [0.22, 0, 0],
      distal: [0.14, 0, 0],
    },
    middle: {
      proximal: [0.22, 0, 0],
      intermediate: [0.26, 0, 0],
      distal: [0.16, 0, 0],
    },
    ring: {
      proximal: [0.24, 0, -0.02],
      intermediate: [0.28, 0, 0],
      distal: [0.18, 0, 0],
    },
    little: {
      proximal: [0.26, 0, -0.04],
      intermediate: [0.30, 0, 0],
      distal: [0.20, 0, 0],
    },
  };

  public static readonly OPEN_PALM_FINGERS: HandFingerSet = {
    thumb: {
      proximal: [-0.02, 0.06, 0.08],
      distal: [0.02, 0, 0.03],
    },
    index: {
      proximal: [0.06, 0, 0.04],
      intermediate: [0.08, 0, 0],
      distal: [0.05, 0, 0],
    },
    middle: {
      proximal: [0.07, 0, 0.01],
      intermediate: [0.09, 0, 0],
      distal: [0.06, 0, 0],
    },
    ring: {
      proximal: [0.09, 0, -0.02],
      intermediate: [0.11, 0, 0],
      distal: [0.07, 0, 0],
    },
    little: {
      proximal: [0.11, 0, -0.04],
      intermediate: [0.13, 0, 0],
      distal: [0.08, 0, 0],
    },
  };

  public static readonly POINTING_FINGERS: HandFingerSet = {
    thumb: {
      proximal: [0.25, 0.10, 0.08],
      distal: [0.18, 0, 0],
    },
    index: {
      proximal: [0.02, 0, 0.02],
      intermediate: [0.03, 0, 0],
      distal: [0.02, 0, 0],
    },
    middle: {
      proximal: [0.65, 0, 0],
      intermediate: [0.75, 0, 0],
      distal: [0.50, 0, 0],
    },
    ring: {
      proximal: [0.70, 0, -0.02],
      intermediate: [0.80, 0, 0],
      distal: [0.55, 0, 0],
    },
    little: {
      proximal: [0.72, 0, -0.04],
      intermediate: [0.82, 0, 0],
      distal: [0.58, 0, 0],
    },
  };

  public static readonly THINKING_FINGERS: HandFingerSet = {
    thumb: {
      proximal: [0.15, 0.08, 0.10],
      distal: [0.10, 0, 0],
    },
    index: {
      proximal: [0.10, 0, 0.03],
      intermediate: [0.14, 0, 0],
      distal: [0.08, 0, 0],
    },
    middle: {
      proximal: [0.25, 0, 0],
      intermediate: [0.35, 0, 0],
      distal: [0.20, 0, 0],
    },
    ring: {
      proximal: [0.40, 0, -0.02],
      intermediate: [0.50, 0, 0],
      distal: [0.35, 0, 0],
    },
    little: {
      proximal: [0.48, 0, -0.04],
      intermediate: [0.58, 0, 0],
      distal: [0.40, 0, 0],
    },
  };

  // Base Natural Idle Arm Transforms:
  // - Upper arms have natural clearance from torso (~1.27 rad ≈ 73° down, leaving ~17° outward room)
  // - Slight forward inclination (0.08 rad)
  // - Elbows have a gentle resting flexion (0.12 rad bend), preventing locked/rigid arms
  // - Wrists are relaxed with gentle inward angle
  private static readonly BASE_LEFT_UPPER_ARM: BoneRotation = [0.08, -0.04, 1.27];
  private static readonly BASE_LEFT_LOWER_ARM: BoneRotation = [0.06, 0.12, 0.04];
  private static readonly BASE_LEFT_HAND: BoneRotation = [0.04, -0.02, -0.02];

  private static readonly BASE_RIGHT_UPPER_ARM: BoneRotation = [0.08, 0.04, -1.27];
  private static readonly BASE_RIGHT_LOWER_ARM: BoneRotation = [0.06, -0.12, -0.04];
  private static readonly BASE_RIGHT_HAND: BoneRotation = [0.04, 0.02, 0.02];

  /**
   * Retrieves emotion-based dynamics (amplitude, speed, head tilt bias)
   */
  public static getEmotionDynamics(emotion?: Emotion | string): EmotionDynamics {
    const emo = (emotion || 'calm').toLowerCase();
    switch (emo) {
      case 'happy':
      case 'joyful':
      case 'cheerful':
      case 'playful':
      case 'amused':
        return { amplitude: 0.48, speed: 1.1, headPitchBias: -0.025, headRollBias: 0.02 };

      case 'excited':
      case 'enthusiastic':
        return { amplitude: 0.58, speed: 1.25, headPitchBias: -0.035, headRollBias: 0.03 };

      case 'sad':
      case 'melancholic':
      case 'lonely':
      case 'disappointed':
        return { amplitude: 0.22, speed: 0.75, headPitchBias: 0.065, headRollBias: -0.01 };

      case 'serious':
      case 'focused':
      case 'determined':
      case 'protective':
        return { amplitude: 0.36, speed: 0.95, headPitchBias: 0.02, headRollBias: 0.0 };

      case 'angry':
      case 'annoyed':
      case 'irritated':
      case 'frustrated':
        return { amplitude: 0.42, speed: 1.3, headPitchBias: 0.03, headRollBias: -0.02 };

      case 'shy':
      case 'embarrassed':
      case 'nervous':
      case 'worried':
        return { amplitude: 0.28, speed: 0.9, headPitchBias: 0.04, headRollBias: 0.035 };

      case 'surprised':
      case 'shocked':
        return { amplitude: 0.42, speed: 1.4, headPitchBias: -0.04, headRollBias: 0.02 };

      case 'curious':
      case 'interested':
      case 'confused':
        return { amplitude: 0.38, speed: 1.05, headPitchBias: -0.015, headRollBias: 0.055 };

      case 'thoughtful':
      case 'thinking':
        return { amplitude: 0.32, speed: 0.85, headPitchBias: 0.035, headRollBias: 0.045 };

      case 'loving':
      case 'affectionate':
      case 'warm':
      case 'gentle':
        return { amplitude: 0.36, speed: 0.95, headPitchBias: 0.015, headRollBias: 0.025 };

      case 'calm':
      case 'relaxed':
      case 'neutral':
      default:
        return { amplitude: 0.35, speed: 1.0, headPitchBias: 0.0, headRollBias: 0.0 };
    }
  }

  /**
   * Evaluates if a spoken sentence contains a meaningful semantic emphasis
   * to trigger at most ONE subtle body-language gesture.
   * Returns null for 85–90% of everyday conversation.
   */
  public static extractSubtleSpeechCue(
    spokenText: string,
    speechDuration: number
  ): { gesture: SubtleGestureType; timeOffset: number; hand: 'left' | 'right' } | null {
    if (!spokenText || spokenText.length < 5) return null;
    const lower = spokenText.toLowerCase();

    // Priority 1: Greeting or farewell (very gentle greeting wave or small open palm)
    if (lower.match(/\b(hello|hi there|welcome|greetings|good morning|good evening)\b/)) {
      return { gesture: 'small_wave', timeOffset: 0.2, hand: 'right' };
    }
    if (lower.match(/\b(farewell|goodbye|see you|take care|until next time)\b/)) {
      return { gesture: 'small_open_palm', timeOffset: 0.3, hand: 'right' };
    }

    // Priority 2: Deep promise / heartfelt / personal conviction (touch chest)
    if (lower.match(/\b(promise|i promise|my heart|i swear|truly|cherish|deeply|i feel|with all)\b/)) {
      const idx = lower.search(/\b(promise|i promise|my heart|i swear|truly|cherish|deeply|i feel|with all)\b/);
      const ratio = Math.max(0.15, Math.min(0.65, idx / Math.max(1, lower.length)));
      return { gesture: 'touch_chest', timeOffset: speechDuration * ratio, hand: 'right' };
    }

    // Priority 3: "Wait" or "Hold on" (small brief palm gesture)
    if (lower.match(/\b(wait|hold on|just a moment|pause|one second)\b/)) {
      return { gesture: 'small_wait', timeOffset: 0.3, hand: 'right' };
    }

    // Priority 4: Explaining / Introducing something (subtle open-palm gesture)
    if (lower.match(/\b(for example|let me explain|you see|consider this|notice how|look here|in truth)\b/)) {
      const handChoice = Math.random() > 0.4 ? 'right' : 'left';
      return { gesture: 'small_explain', timeOffset: Math.min(1.2, speechDuration * 0.3), hand: handChoice };
    }

    // Priority 5: Pointing out or emphasizing a specific thought ("this", "you", "that")
    if (lower.match(/\b(exactly|precisely|that is why|remember this|above all|specifically)\b/)) {
      return { gesture: 'small_point', timeOffset: Math.min(1.5, speechDuration * 0.4), hand: 'right' };
    }

    // Priority 6: Unsure / Thinking / Pondering ("perhaps", "maybe", "i wonder")
    if (lower.match(/\b(perhaps|maybe|i wonder|could it be|who knows|uncertain)\b/)) {
      return { gesture: 'small_unsure', timeOffset: Math.min(1.0, speechDuration * 0.3), hand: 'right' };
    }

    // Default: 85-90% of spoken conversation has NO hand gestures (pure natural idle)
    return null;
  }

  /**
   * Main Kinetic Evaluation: Computes smooth bone transforms for expressive body parts
   * adhering strictly to the Living Natural Idle-First & Subtle Body Language architecture.
   */
  public static computePose(params: {
    emotion: Emotion | string;
    facialExpression?: ColumbinaFacialExpression | string;
    action?: ColumbinaAction | string;
    isSpeaking: boolean;
    isListening: boolean;
    userEmotion?: string;
    elapsedTime: number;
    intensity?: number;
    activeGesture?: ActiveGestureState | null;
  }): BodyExpressionPose {
    const {
      emotion = 'calm',
      isSpeaking,
      isListening,
      userEmotion,
      elapsedTime,
      intensity = 0.35,
      activeGesture,
    } = params;

    const dynamics = this.getEmotionDynamics(emotion);
    const emoWeight = Math.max(0.15, Math.min(0.85, intensity));

    // =========================================================================
    // 1. LAYERED MULTI-FREQUENCY LIVING IDLE HARMONICS
    // Combines prime periods so movements never repeat like a static mechanical loop
    // =========================================================================

    // A. Natural Respiration Wave (~3.6s cycle with asymmetric inhalation/exhalation)
    const breathPhase = elapsedTime * 1.75;
    const rawBreath = Math.sin(breathPhase) + 0.18 * Math.sin(breathPhase * 2.0);
    const breathInhale = rawBreath * 0.5; // Normalized gentle range

    const breathChest = breathInhale * 0.009;
    const breathSpine = breathInhale * 0.0045;
    const breathShoulder = breathInhale * 0.007;

    // Secondary arm motion from breathing (chest expansion gently displaces upper arms)
    const breathArmSway = breathInhale * 0.010;
    const breathArmPitch = breathInhale * 0.005;

    // B. Subtle Weight Shifting & Core Micro-Balance (~14.3s + ~9.1s harmonic combination)
    const weightShiftCycle1 = Math.sin(elapsedTime * 0.44);
    const weightShiftCycle2 = Math.sin(elapsedTime * 0.28 + 1.4);
    const weightShift = (weightShiftCycle1 * 0.6 + weightShiftCycle2 * 0.4) * 0.008;

    const hipYaw = Math.sin(elapsedTime * 0.21) * 0.005;
    const spineCounterRoll = -weightShift * 0.85;

    // C. Non-Repeating Arm & Hand Living Micro-Drift (Very subtle living adjustments)
    const leftArmDriftX = Math.sin(elapsedTime * 0.63) * 0.007 + Math.cos(elapsedTime * 0.29) * 0.004;
    const leftArmDriftY = Math.cos(elapsedTime * 0.47) * 0.005;
    const leftArmDriftZ = Math.sin(elapsedTime * 0.39) * 0.008;

    const rightArmDriftX = Math.sin(elapsedTime * 0.58 + 1.2) * 0.007 + Math.cos(elapsedTime * 0.31 + 0.5) * 0.004;
    const rightArmDriftY = Math.cos(elapsedTime * 0.41 + 0.8) * 0.005;
    const rightArmDriftZ = Math.sin(elapsedTime * 0.35 + 1.5) * 0.008;

    // Elbow micro-relaxation
    const leftElbowDrift = Math.sin(elapsedTime * 0.51) * 0.008;
    const rightElbowDrift = Math.sin(elapsedTime * 0.46 + 1.0) * 0.008;

    // Wrist living micro-flexion
    const leftWristDriftX = Math.sin(elapsedTime * 0.72) * 0.006;
    const leftWristDriftZ = Math.cos(elapsedTime * 0.55) * 0.005;
    const rightWristDriftX = Math.sin(elapsedTime * 0.68 + 0.7) * 0.006;
    const rightWristDriftZ = Math.cos(elapsedTime * 0.49 + 1.1) * 0.005;

    // D. Subtle Organic Finger Micro-Articulation (Individual finger life)
    const fingerBaseWave = Math.sin(elapsedTime * 0.52);
    const fingerThumbFlex = fingerBaseWave * 0.012 + Math.sin(elapsedTime * 0.83) * 0.006;
    const fingerIndexFlex = fingerBaseWave * 0.018 + Math.sin(elapsedTime * 0.76 + 0.4) * 0.008;
    const fingerMiddleFlex = fingerBaseWave * 0.020 + Math.sin(elapsedTime * 0.71 + 0.8) * 0.009;
    const fingerRingFlex = fingerBaseWave * 0.022 + Math.sin(elapsedTime * 0.67 + 1.2) * 0.010;
    const fingerLittleFlex = fingerBaseWave * 0.024 + Math.sin(elapsedTime * 0.63 + 1.6) * 0.011;

    // E. Living Head & Neck Organic Micro-Adjustments
    const headDriftPitch = Math.sin(elapsedTime * 0.31) * 0.010 + Math.sin(elapsedTime * 0.77) * 0.004;
    const headDriftYaw = Math.cos(elapsedTime * 0.23) * 0.012;
    const headDriftRoll = Math.sin(elapsedTime * 0.17) * 0.008;

    const neckDriftPitch = headDriftPitch * 0.45;
    const neckDriftRoll = headDriftRoll * 0.45;

    // =========================================================================
    // 2. CONSTRUCT LIVING IDLE BASELINE POSE
    // =========================================================================
    const pose: BodyExpressionPose = {
      hips: [0, hipYaw, weightShift],
      spine: [breathSpine, -hipYaw * 0.7, spineCounterRoll],
      chest: [breathChest, 0, 0],
      head: [
        headDriftPitch + dynamics.headPitchBias * emoWeight,
        headDriftYaw,
        headDriftRoll + dynamics.headRollBias * emoWeight,
      ],
      neck: [
        neckDriftPitch + dynamics.headPitchBias * 0.45 * emoWeight,
        headDriftYaw * 0.4,
        neckDriftRoll + dynamics.headRollBias * 0.45 * emoWeight,
      ],
      leftShoulder: [0, 0, breathShoulder],
      rightShoulder: [0, 0, -breathShoulder],

      // Left Arm: Natural clearance, living breathing sway & micro-drift
      leftUpperArm: [
        this.BASE_LEFT_UPPER_ARM[0] + breathArmPitch + leftArmDriftX,
        this.BASE_LEFT_UPPER_ARM[1] + leftArmDriftY,
        this.BASE_LEFT_UPPER_ARM[2] - breathArmSway + leftArmDriftZ,
      ],
      leftLowerArm: [
        this.BASE_LEFT_LOWER_ARM[0] + leftElbowDrift,
        this.BASE_LEFT_LOWER_ARM[1] + leftElbowDrift * 0.5,
        this.BASE_LEFT_LOWER_ARM[2],
      ],
      leftHand: [
        this.BASE_LEFT_HAND[0] + leftWristDriftX,
        this.BASE_LEFT_HAND[1],
        this.BASE_LEFT_HAND[2] + leftWristDriftZ,
      ],

      // Right Arm: Natural clearance, living breathing sway & micro-drift
      rightUpperArm: [
        this.BASE_RIGHT_UPPER_ARM[0] + breathArmPitch + rightArmDriftX,
        this.BASE_RIGHT_UPPER_ARM[1] + rightArmDriftY,
        this.BASE_RIGHT_UPPER_ARM[2] + breathArmSway + rightArmDriftZ,
      ],
      rightLowerArm: [
        this.BASE_RIGHT_LOWER_ARM[0] + rightElbowDrift,
        this.BASE_RIGHT_LOWER_ARM[1] - rightElbowDrift * 0.5,
        this.BASE_RIGHT_LOWER_ARM[2],
      ],
      rightHand: [
        this.BASE_RIGHT_HAND[0] + rightWristDriftX,
        this.BASE_RIGHT_HAND[1],
        this.BASE_RIGHT_HAND[2] + rightWristDriftZ,
      ],

      leftUpperLeg: [0, 0, weightShift * 0.5],
      rightUpperLeg: [0, 0, weightShift * 0.5],

      leftFingers: this.buildLivingFingers(this.NATURAL_IDLE_FINGERS, {
        thumb: fingerThumbFlex,
        index: fingerIndexFlex,
        middle: fingerMiddleFlex,
        ring: fingerRingFlex,
        little: fingerLittleFlex,
      }),
      rightFingers: this.buildLivingFingers(this.NATURAL_IDLE_FINGERS, {
        thumb: -fingerThumbFlex,
        index: -fingerIndexFlex,
        middle: -fingerMiddleFlex,
        ring: -fingerRingFlex,
        little: -fingerLittleFlex,
      }),

      mouthScale: 1.0,
      mouthEmotionMod: { happyAdd: 0, sadAdd: 0, surprisedAdd: 0 },
    };

    // =========================================================================
    // 3. SPEAKING BEHAVIOR (Cadence & subtle head nod only; hands stay down)
    // =========================================================================
    if (isSpeaking) {
      const speakNod = Math.sin(elapsedTime * 2.8) * 0.012 * emoWeight;
      pose.head![0] += speakNod;
      pose.neck![0] += speakNod * 0.3;
    }

    // =========================================================================
    // 4. LISTENING BEHAVIOR (Attentive posture & tilt; hands stay down)
    // =========================================================================
    if (isListening) {
      const listenTilt = 0.035 * emoWeight;
      let pitchOffset = 0.01;
      if (userEmotion === 'sad' || userEmotion === 'worried') {
        pitchOffset = 0.03;
      }
      pose.head![0] += pitchOffset;
      pose.head![2] += listenTilt;
      pose.neck![0] += pitchOffset * 0.4;
      pose.neck![2] += listenTilt * 0.5;
    }

    // =========================================================================
    // 5. SUBTLE NATURAL BODY LANGUAGE GESTURES
    // Modulates ONE arm asymmetrically with small amplitude, guaranteed return to idle
    // =========================================================================
    if (activeGesture && activeGesture.duration > 0) {
      const totalDuration = activeGesture.duration / Math.max(0.6, dynamics.speed);
      const gestureProgress = (elapsedTime - activeGesture.startTime) / totalDuration;

      if (gestureProgress >= 0 && gestureProgress <= 1.0) {
        // 3-Phase Smooth Kinematic Envelope:
        // Phase 1 (0.0 -> 0.22): Smooth Ease In
        // Phase 2 (0.22 -> 0.58): Peak Hold with subtle micro-accent
        // Phase 3 (0.58 -> 1.00): Smooth Ease Out seamlessly back into Living Idle
        let envelope = 0;
        if (gestureProgress < 0.22) {
          const t = gestureProgress / 0.22;
          envelope = Math.sin((t * Math.PI) / 2);
        } else if (gestureProgress < 0.58) {
          const holdPhase = (gestureProgress - 0.22) / 0.36;
          // Subtle breathing accent during peak hold
          envelope = 1.0 - 0.04 * Math.sin(holdPhase * Math.PI);
        } else {
          const t = (1.0 - gestureProgress) / 0.42;
          envelope = Math.sin((t * Math.PI) / 2);
        }

        // Apply emotion dynamics amplitude scaling (small, elegant micro-movements)
        const gScale = activeGesture.intensity * envelope * dynamics.amplitude;
        const gHand = activeGesture.hand || 'right';
        const act = activeGesture.action;

        // A. Small Open Palm / Explain Gesture (Subtle outward forearm/wrist pivot)
        if (act === 'open_palm_gesture' || act === 'small_open_palm' || act === 'small_explain') {
          if (gHand === 'right') {
            pose.rightUpperArm = [
              pose.rightUpperArm![0] + 0.16 * gScale,
              pose.rightUpperArm![1] - 0.10 * gScale,
              pose.rightUpperArm![2] + 0.45 * gScale,
            ];
            pose.rightLowerArm = [
              pose.rightLowerArm![0] + 0.24 * gScale,
              pose.rightLowerArm![1] - 0.08 * gScale,
              pose.rightLowerArm![2] + 0.12 * gScale,
            ];
            pose.rightHand = [
              pose.rightHand![0] + 0.10 * gScale,
              pose.rightHand![1] - 0.08 * gScale,
              pose.rightHand![2] + 0.06 * gScale,
            ];
            pose.rightFingers = this.OPEN_PALM_FINGERS;
          } else {
            pose.leftUpperArm = [
              pose.leftUpperArm![0] + 0.16 * gScale,
              pose.leftUpperArm![1] + 0.10 * gScale,
              pose.leftUpperArm![2] - 0.45 * gScale,
            ];
            pose.leftLowerArm = [
              pose.leftLowerArm![0] + 0.24 * gScale,
              pose.leftLowerArm![1] + 0.08 * gScale,
              pose.leftLowerArm![2] - 0.12 * gScale,
            ];
            pose.leftHand = [
              pose.leftHand![0] + 0.10 * gScale,
              pose.leftHand![1] + 0.08 * gScale,
              pose.leftHand![2] - 0.06 * gScale,
            ];
            pose.leftFingers = this.OPEN_PALM_FINGERS;
          }
        }
        // B. Touch Chest / Heartfelt Conviction / Comforting Gesture
        else if (act === 'touch_chest' || act === 'comforting_gesture') {
          if (gHand === 'right') {
            pose.rightUpperArm = [
              pose.rightUpperArm![0] + 0.26 * gScale,
              pose.rightUpperArm![1] - 0.18 * gScale,
              pose.rightUpperArm![2] + 0.85 * gScale,
            ];
            pose.rightLowerArm = [
              pose.rightLowerArm![0] + 0.38 * gScale,
              pose.rightLowerArm![1] - 0.08 * gScale,
              pose.rightLowerArm![2] + 0.12 * gScale,
            ];
            pose.rightHand = [
              pose.rightHand![0] + 0.12 * gScale,
              pose.rightHand![1] - 0.08 * gScale,
              pose.rightHand![2] + 0.04 * gScale,
            ];
            pose.rightFingers = this.NATURAL_IDLE_FINGERS;
          } else {
            pose.leftUpperArm = [
              pose.leftUpperArm![0] + 0.26 * gScale,
              pose.leftUpperArm![1] + 0.18 * gScale,
              pose.leftUpperArm![2] - 0.85 * gScale,
            ];
            pose.leftLowerArm = [
              pose.leftLowerArm![0] + 0.38 * gScale,
              pose.leftLowerArm![1] + 0.08 * gScale,
              pose.leftLowerArm![2] - 0.12 * gScale,
            ];
            pose.leftHand = [
              pose.leftHand![0] + 0.12 * gScale,
              pose.leftHand![1] + 0.08 * gScale,
              pose.leftHand![2] - 0.04 * gScale,
            ];
            pose.leftFingers = this.NATURAL_IDLE_FINGERS;
          }
        }
        // C. Small Point / Precision Emphasis (Tiny forward point at lower chest height)
        else if (act === 'point' || act === 'small_point') {
          pose.rightUpperArm = [
            pose.rightUpperArm![0] + 0.18 * gScale,
            pose.rightUpperArm![1] - 0.06 * gScale,
            pose.rightUpperArm![2] + 0.48 * gScale,
          ];
          pose.rightLowerArm = [
            pose.rightLowerArm![0] + 0.20 * gScale,
            pose.rightLowerArm![1] - 0.04 * gScale,
            pose.rightLowerArm![2] + 0.05 * gScale,
          ];
          pose.rightHand = [
            pose.rightHand![0] + 0.08 * gScale,
            pose.rightHand![1] - 0.04 * gScale,
            pose.rightHand![2] + 0.02 * gScale,
          ];
          pose.rightFingers = this.POINTING_FINGERS;
        }
        // D. "Wait" / Brief Palm Stop Gesture
        else if (act === 'small_wait') {
          pose.rightUpperArm = [
            pose.rightUpperArm![0] + 0.14 * gScale,
            pose.rightUpperArm![1] - 0.06 * gScale,
            pose.rightUpperArm![2] + 0.40 * gScale,
          ];
          pose.rightLowerArm = [
            pose.rightLowerArm![0] + 0.22 * gScale,
            pose.rightLowerArm![1] - 0.04 * gScale,
            pose.rightLowerArm![2],
          ];
          pose.rightHand = [
            pose.rightHand![0] + 0.18 * gScale,
            pose.rightHand![1],
            pose.rightHand![2] + 0.06 * gScale,
          ];
          pose.rightFingers = this.OPEN_PALM_FINGERS;
        }
        // E. Thoughtful Pose (Subtle chin inclination, hand remains low near collar)
        else if (act === 'thoughtful_pose') {
          pose.rightUpperArm = [
            pose.rightUpperArm![0] + 0.25 * gScale,
            pose.rightUpperArm![1] - 0.12 * gScale,
            pose.rightUpperArm![2] + 0.70 * gScale,
          ];
          pose.rightLowerArm = [
            pose.rightLowerArm![0] + 0.40 * gScale,
            pose.rightLowerArm![1] - 0.04 * gScale,
            pose.rightLowerArm![2],
          ];
          pose.rightHand = [
            pose.rightHand![0] + 0.12 * gScale,
            pose.rightHand![1],
            pose.rightHand![2] + 0.08 * gScale,
          ];
          pose.rightFingers = this.THINKING_FINGERS;
          pose.head![0] += 0.025 * gScale;
          pose.head![1] += 0.02 * gScale;
          pose.head![2] += 0.03 * gScale;
        }
        // F. Unsure / Hesitant (Tiny shoulder lift, slight wrist turn, subtle head tilt)
        else if (act === 'small_unsure' || act === 'small_hesitant') {
          pose.rightShoulder![2] -= 0.015 * gScale;
          pose.leftShoulder![2] += 0.015 * gScale;
          pose.rightHand![1] += 0.04 * gScale;
          pose.leftHand![1] -= 0.04 * gScale;
          pose.head![2] += 0.04 * gScale;
        }
        // G. Small Wave (Gentle wrist greeting at mid-chest level, NOT large high arm swing)
        else if (act === 'small_wave' || act === 'greeting') {
          const waveOsc = Math.sin((elapsedTime - activeGesture.startTime) * 7.0) * 0.12 * gScale;
          pose.rightUpperArm = [
            pose.rightUpperArm![0] + 0.22 * gScale,
            pose.rightUpperArm![1] - 0.10 * gScale,
            pose.rightUpperArm![2] + 0.65 * gScale,
          ];
          pose.rightLowerArm = [
            pose.rightLowerArm![0] + 0.35 * gScale,
            pose.rightLowerArm![1],
            pose.rightLowerArm![2] + 0.10 * gScale,
          ];
          pose.rightHand = [
            pose.rightHand![0] + 0.10 * gScale,
            pose.rightHand![1] + waveOsc,
            pose.rightHand![2] + 0.08 * gScale,
          ];
          pose.rightFingers = this.OPEN_PALM_FINGERS;
        }
        // H. Small Head Tilt or Nod (Pure head motion, hands stay down)
        else if (act === 'small_head_tilt') {
          pose.head![2] += (gHand === 'right' ? 0.06 : -0.06) * gScale;
          pose.neck![2] += (gHand === 'right' ? 0.03 : -0.03) * gScale;
        } else if (act === 'small_nod' || act === 'nod') {
          const nodOsc = Math.sin((elapsedTime - activeGesture.startTime) * 5.0) * 0.05 * gScale;
          pose.head![0] += nodOsc;
          pose.neck![0] += nodOsc * 0.4;
        }
        // I. Surprised Reaction (Brief slight hand flutter, quick recovery)
        else if (act === 'surprised_reaction') {
          pose.chest![0] += 0.02 * gScale;
          pose.rightUpperArm![2] += 0.25 * gScale;
          pose.leftUpperArm![2] -= 0.25 * gScale;
          pose.rightHand![0] += 0.10 * gScale;
          pose.leftHand![0] += 0.10 * gScale;
          pose.rightFingers = this.OPEN_PALM_FINGERS;
          pose.leftFingers = this.OPEN_PALM_FINGERS;
        }
      }
    }

    return pose;
  }

  private static buildLivingFingers(
    base: HandFingerSet,
    flexMap: { thumb: number; index: number; middle: number; ring: number; little: number }
  ): HandFingerSet {
    return {
      thumb: {
        proximal: [
          (base.thumb?.proximal?.[0] || 0) + flexMap.thumb * 0.5,
          base.thumb?.proximal?.[1] || 0,
          base.thumb?.proximal?.[2] || 0,
        ],
        distal: base.thumb?.distal,
      },
      index: {
        proximal: [
          (base.index?.proximal?.[0] || 0) + flexMap.index,
          base.index?.proximal?.[1] || 0,
          base.index?.proximal?.[2] || 0,
        ],
        intermediate: base.index?.intermediate,
        distal: base.index?.distal,
      },
      middle: {
        proximal: [
          (base.middle?.proximal?.[0] || 0) + flexMap.middle,
          base.middle?.proximal?.[1] || 0,
          base.middle?.proximal?.[2] || 0,
        ],
        intermediate: base.middle?.intermediate,
        distal: base.middle?.distal,
      },
      ring: {
        proximal: [
          (base.ring?.proximal?.[0] || 0) + flexMap.ring,
          base.ring?.proximal?.[1] || 0,
          base.ring?.proximal?.[2] || 0,
        ],
        intermediate: base.ring?.intermediate,
        distal: base.ring?.distal,
      },
      little: {
        proximal: [
          (base.little?.proximal?.[0] || 0) + flexMap.little,
          base.little?.proximal?.[1] || 0,
          base.little?.proximal?.[2] || 0,
        ],
        intermediate: base.little?.intermediate,
        distal: base.little?.distal,
      },
    };
  }
}
