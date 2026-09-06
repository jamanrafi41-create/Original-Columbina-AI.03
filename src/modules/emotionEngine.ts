/**
 * Emotion Engine for Columbina
 * Implements the 10-step internal determination pipeline:
 * 1. User intent & topic
 * 2. User desired outcome
 * 3. User emotional state & paralinguistics
 * 4. Columbina's current continuous emotional state
 * 5. Columbina's appropriate response emotion
 * 6. Emotional intensity calculation (0.0 to 1.0, typical 0.2 to 0.65)
 * 7. Speaking style and tone
 * 8. VRM facial expression
 * 9. VRM body/hand animation/gesture
 * 10. Voice characteristics for Fish Audio / Neural TTS
 */

import {
  Emotion,
  ColumbinaAction,
  ColumbinaFacialExpression,
  EmotionEngineMetadata,
  ParalinguisticAnalysis,
  StructuredAIResponse,
} from '../types';
import { UserEmotionDetector, UserEmotionAnalysis } from './userEmotionDetector';
import { ConversationStateTracker, conversationState } from './conversationState';
import { VoiceEmotionController, VoiceParameters } from './voiceEmotionController';
import { VRMActionController } from './vrmActionController';
import { VRMExpressionController } from './vrmExpressionController';

export interface EmotionEngineResult {
  metadata: EmotionEngineMetadata;
  voiceParams: VoiceParameters;
  userAnalysis: UserEmotionAnalysis;
}

export class EmotionEngine {
  /**
   * Evaluates input and current state to determine complete emotion & behavioral parameters
   */
  public static process(
    userText: string,
    voiceAnalysis?: ParalinguisticAnalysis,
    aiRawEmotion?: string,
    aiRawAction?: string,
    aiRawExpression?: string,
    aiIntensity?: number
  ): EmotionEngineResult {
    // Steps 1, 2, 3: User Intent, Desired Outcome & Emotional State
    const userAnalysis = UserEmotionDetector.analyze(userText, voiceAnalysis);

    // Step 4: Columbina's continuous emotional state
    const currentState = conversationState.getState();

    // Steps 5 & 6: Determine Columbina's response emotion & intensity
    // Emotion Priority Rules:
    // 1. Safety / distress -> calm, caring, gentle
    // 2. Strong user emotion -> resonant response
    // 3. Conversation context & AI inference
    // 4. Current continuous state
    // 5. Personality base
    let finalEmotion: Emotion = 'calm';
    let finalIntensity = 0.35;
    let finalAction: ColumbinaAction = 'idle';
    let finalFacialExpression: ColumbinaFacialExpression = 'neutral';
    let finalVoiceStyle = 'thoughtful_calm';

    // Check if AI explicitly gave a high-validity emotion
    if (aiRawEmotion && typeof aiRawEmotion === 'string') {
      finalEmotion = aiRawEmotion as Emotion;
    } else {
      // Deterministic priority-based emotion mapping
      if (userAnalysis.isUrgentOrDistressed) {
        finalEmotion = 'caring';
        finalIntensity = 0.6;
        finalAction = 'comforting_gesture';
        finalFacialExpression = 'concerned';
        finalVoiceStyle = 'gentle_whisper';
      } else if (userAnalysis.primaryEmotion === 'frustrated') {
        finalEmotion = 'calm';
        finalIntensity = 0.45;
        finalAction = 'look_at_user';
        finalFacialExpression = 'neutral';
        finalVoiceStyle = 'thoughtful_calm';
      } else if (userAnalysis.isTeasing) {
        finalEmotion = 'teasing';
        finalIntensity = 0.48;
        finalAction = 'small_head_tilt';
        finalFacialExpression = 'teasing';
        finalVoiceStyle = 'warm_playful';
      } else if (userAnalysis.isCompliment) {
        finalEmotion = 'warm';
        finalIntensity = 0.45;
        finalAction = 'touch_chest';
        finalFacialExpression = 'soft_smile';
        finalVoiceStyle = 'intimate_soft';
      } else if (userAnalysis.isJoking) {
        finalEmotion = 'amused';
        finalIntensity = 0.42;
        finalAction = 'small_head_tilt';
        finalFacialExpression = 'soft_smile';
        finalVoiceStyle = 'warm_playful';
      } else if (userAnalysis.isGreeting) {
        finalEmotion = 'gentle';
        finalIntensity = 0.38;
        finalAction = 'small_wave';
        finalFacialExpression = 'soft_smile';
        finalVoiceStyle = 'warm_playful';
      } else if (userAnalysis.isFarewell) {
        finalEmotion = 'affectionate';
        finalIntensity = 0.4;
        finalAction = 'farewell';
        finalFacialExpression = 'soft_smile';
        finalVoiceStyle = 'gentle_whisper';
      } else if (userAnalysis.isSeriousQuery) {
        finalEmotion = 'thoughtful';
        finalIntensity = 0.4;
        finalAction = 'thoughtful_pose';
        finalFacialExpression = 'thoughtful';
        finalVoiceStyle = 'thoughtful_calm';
      } else {
        // Natural subtle mood variance based on current state continuity
        finalEmotion = currentState.currentEmotion === 'calm' ? 'gentle' : currentState.currentEmotion;
        finalIntensity = Math.max(0.25, Math.min(0.55, currentState.intensity));
        finalAction = 'idle';
        finalFacialExpression = 'neutral';
      }
    }

    // Blend AI provided intensity if valid
    if (typeof aiIntensity === 'number' && !isNaN(aiIntensity)) {
      finalIntensity = Math.max(0.1, Math.min(1.0, (finalIntensity + aiIntensity) / 2));
    }

    // Step 8 & 9: VRM Facial Expression and Action / Gesture
    if (aiRawAction) {
      finalAction = VRMActionController.normalizeAction(aiRawAction);
    }
    if (aiRawExpression) {
      finalFacialExpression = aiRawExpression as ColumbinaFacialExpression;
    }

    // Step 10: Voice parameters
    const voiceParams = VoiceEmotionController.resolveVoiceParams(
      finalEmotion,
      finalIntensity,
      finalVoiceStyle
    );

    // Update conversation state continuity
    conversationState.transitionEmotion(finalEmotion, finalIntensity, userAnalysis.primaryEmotion);

    const metadata: EmotionEngineMetadata = {
      emotion: finalEmotion,
      intensity: finalIntensity,
      userEmotion: userAnalysis.primaryEmotion,
      voiceStyle: finalVoiceStyle,
      voiceSpeed: voiceParams.speed,
      voicePitch: voiceParams.pitch,
      facialExpression: finalFacialExpression,
      action: finalAction,
      gesture: finalAction,
    };

    return {
      metadata,
      voiceParams,
      userAnalysis,
    };
  }
}
