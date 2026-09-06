/**
 * Conversation Emotional State & Continuity Engine
 * Maintains emotional persistence across turns so Columbina transitions naturally
 * instead of resetting to neutral every message.
 */

import { Emotion } from '../types';

export interface EmotionalStateSnapshot {
  currentEmotion: Emotion;
  intensity: number; // 0.0 - 1.0
  userMood: string;
  topicContext: string;
  turnCount: number;
  lastUpdated: number;
}

export class ConversationStateTracker {
  private static instance: ConversationStateTracker;

  private state: EmotionalStateSnapshot = {
    currentEmotion: 'calm',
    intensity: 0.35,
    userMood: 'neutral',
    topicContext: 'intimate_companionship',
    turnCount: 0,
    lastUpdated: Date.now(),
  };

  private emotionHistory: Array<{ emotion: Emotion; intensity: number; timestamp: number }> = [];

  public static getInstance(): ConversationStateTracker {
    if (!ConversationStateTracker.instance) {
      ConversationStateTracker.instance = new ConversationStateTracker();
    }
    return ConversationStateTracker.instance;
  }

  public getState(): EmotionalStateSnapshot {
    return { ...this.state };
  }

  /**
   * Smoothly transitions Columbina's emotional state based on the new target emotion.
   * Prevents jarring 0->1 jumps by blending with the previous mood unless high urgency.
   */
  public transitionEmotion(targetEmotion: Emotion, targetIntensity: number = 0.4, userMood: string = 'neutral'): EmotionalStateSnapshot {
    const prevEmotion = this.state.currentEmotion;
    const prevIntensity = this.state.intensity;

    // Gradual intensity blending
    const blendedIntensity = Number((prevIntensity * 0.35 + targetIntensity * 0.65).toFixed(2));
    const finalIntensity = Math.max(0.1, Math.min(1.0, blendedIntensity));

    this.state = {
      currentEmotion: targetEmotion,
      intensity: finalIntensity,
      userMood,
      topicContext: this.state.topicContext,
      turnCount: this.state.turnCount + 1,
      lastUpdated: Date.now(),
    };

    this.emotionHistory.push({
      emotion: targetEmotion,
      intensity: finalIntensity,
      timestamp: Date.now(),
    });

    if (this.emotionHistory.length > 20) {
      this.emotionHistory.shift();
    }

    return { ...this.state };
  }

  /**
   * Decay emotional intensity gently toward serene baseline when dialogue pauses.
   */
  public naturalDecay(): EmotionalStateSnapshot {
    const elapsed = Date.now() - this.state.lastUpdated;
    if (elapsed > 15000 && this.state.intensity > 0.35) {
      this.state.intensity = Number((this.state.intensity * 0.85).toFixed(2));
    }
    return { ...this.state };
  }

  public reset(): void {
    this.state = {
      currentEmotion: 'calm',
      intensity: 0.35,
      userMood: 'neutral',
      topicContext: 'intimate_companionship',
      turnCount: 0,
      lastUpdated: Date.now(),
    };
    this.emotionHistory = [];
  }
}

export const conversationState = ConversationStateTracker.getInstance();
