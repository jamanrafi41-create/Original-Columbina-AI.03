/**
 * User Emotion Detector
 * Analyzes conversational text and paralinguistic voice signals to accurately
 * understand the user's emotional state, intent, and conversational nuance.
 */

import { ParalinguisticAnalysis, VoiceEmotionSignal } from '../types';

export interface UserEmotionAnalysis {
  primaryEmotion: string;
  intensity: number; // 0.0 - 1.0
  confidence: number; // 0.0 - 1.0
  secondaryEmotions: string[];
  isQuestion: boolean;
  isGreeting: boolean;
  isFarewell: boolean;
  isJoking: boolean;
  isTeasing: boolean;
  isCompliment: boolean;
  isUrgentOrDistressed: boolean;
  isSeriousQuery: boolean;
  suggestedColumbinaReaction: string;
  contextNotes: string;
}

export class UserEmotionDetector {
  /**
   * Evaluates text + optional paralinguistic acoustic signals
   */
  public static analyze(
    text: string,
    voiceAnalysis?: ParalinguisticAnalysis,
    recentContext: string[] = []
  ): UserEmotionAnalysis {
    const raw = (text || '').trim();
    const lower = raw.toLowerCase();

    // 1. Textual signal extraction
    const hasExclamation = /!/.test(raw);
    const multipleExclamations = /!{2,}/.test(raw);
    const hasQuestionMark = /\?/.test(raw);
    const multipleQuestionMarks = /\?{2,}/.test(raw);
    const isAllCaps = raw.length > 5 && raw === raw.toUpperCase() && /[A-Z]/.test(raw);
    const hasEllipsis = /\.{2,}|…/.test(raw);

    // 2. Lexical patterns
    const isGreeting =
      /^(hi|hello|hey|good\s*(morning|afternoon|evening|day)|greetings|yo)\b/i.test(lower) ||
      /\b(nice\s+to\s+meet\s+you|howdy|welcome)\b/i.test(lower);

    const isFarewell =
      /\b(bye|goodbye|see\s+you|farewell|good\s*night|talk\s+to\s+you\s+later|leaving|have\s+to\s+go)\b/i.test(lower);

    const isCompliment =
      /\b(you\s+(are|look)\s+(so\s+)?(pretty|cute|beautiful|gorgeous|sweet|kind|smart|amazing|wonderful|lovely|charming|fascinating|ethereal))\b/i.test(lower) ||
      /\b(i\s+(love|like|adore)\s+you)\b/i.test(lower) ||
      /\b(you're\s+(so\s+)?(sweet|cute|smart|amazing|great))\b/i.test(lower);

    const isTeasing =
      /\b(you\s+(dummy|silly|pouty|scared|shy|jealous))\b/i.test(lower) ||
      /\b(are\s+you\s+blushing|don't\s+be\s+shy|teasing\s+you)\b/i.test(lower) ||
      /(haha|hehe|xd|lmao|lol)/i.test(lower) && /\b(you|columbina)\b/i.test(lower);

    const isJoking =
      /(haha|hehe|lol|lmao|rofl|just\s+kidding|joking|jk|funny)/i.test(lower) ||
      /\b(made\s+you\s+look|gotcha)\b/i.test(lower);

    const isSadOrLonely =
      /\b(sad|lonely|depressed|heartbroken|crying|tears|unhappy|hurts|pain|empty|lost|miss\s+you|nobody\s+cares|alone)\b/i.test(lower) ||
      /\b(bad\s+day|exhausted|miserable|tired\s+of\s+everything)\b/i.test(lower);

    const isFrustratedOrAngry =
      /\b(angry|mad|annoyed|furious|hate\s+this|irritated|stupid|idiot|dammit|shut\s+up|pissed)\b/i.test(lower);

    const isExcitedOrHappy =
      /\b(so\s+happy|excited|yay|awesome|great\s+news|won|passed|celebrate|thrilled|can't\s+wait|fantastic|incredible)\b/i.test(lower);

    const isWorriedOrAnxious =
      /\b(worried|anxious|scared|nervous|afraid|stress|panic|frightened|dread|fear)\b/i.test(lower);

    const isConfused =
      /\b(confused|don't\s+understand|what\s+do\s+you\s+mean|huh|i'm\s+lost|how\s+come|explain)\b/i.test(lower) ||
      (hasQuestionMark && multipleQuestionMarks);

    const isSeriousOrCurious =
      /\b(why|how|explain|what\s+is|tell\s+me\s+about|philosophy|history|meaning\s+of|truth|secret|universe|deep)\b/i.test(lower);

    // 3. Acoustic Paralinguistic Signals (if voice input)
    let vocalPrimary = voiceAnalysis?.voiceEmotion?.primary;
    let vocalIntensity = voiceAnalysis?.voiceEmotion?.intensity ?? 0.35;
    let vocalSound = voiceAnalysis?.vocalSound;

    // 4. Primary Emotion Synthesis
    let primaryEmotion = 'calm';
    let intensity = 0.35;
    let confidence = 0.65;
    const secondaryEmotions: string[] = [];
    let suggestedReaction = 'calm';
    let contextNotes = 'General conversational flow.';

    // Priority 1: Distress / Sadness / Crisis
    if (isSadOrLonely || vocalSound === 'cry' || vocalPrimary === 'sad') {
      primaryEmotion = 'sad';
      intensity = Math.min(0.85, 0.5 + (hasEllipsis ? 0.15 : 0) + (vocalPrimary === 'sad' ? 0.2 : 0));
      confidence = 0.88;
      suggestedReaction = 'gentle_supportive';
      contextNotes = 'User shows sadness or emotional vulnerability. Columbina responds with gentle, warm, patient care.';
    }
    // Priority 2: Anger / Frustration
    else if (isFrustratedOrAngry || vocalPrimary === 'angry' || (isAllCaps && multipleExclamations)) {
      primaryEmotion = 'frustrated';
      intensity = Math.min(0.9, 0.6 + (multipleExclamations ? 0.15 : 0) + (isAllCaps ? 0.15 : 0));
      confidence = 0.85;
      suggestedReaction = 'composed_calm';
      contextNotes = 'User expresses frustration or anger. Columbina maintains poised, unruffled, reassuring calm.';
    }
    // Priority 3: High Excitement / Joy
    else if (isExcitedOrHappy || vocalPrimary === 'enthusiastic' || (multipleExclamations && !isFrustratedOrAngry)) {
      primaryEmotion = 'excited';
      intensity = Math.min(0.85, 0.55 + (multipleExclamations ? 0.15 : 0));
      confidence = 0.84;
      suggestedReaction = 'warm_playful';
      contextNotes = 'User is celebrating or enthusiastic. Columbina reflects with brighter eyes and playful warmth.';
    }
    // Priority 4: Teasing / Banter
    else if (isTeasing || (isJoking && isCompliment)) {
      primaryEmotion = 'teasing';
      intensity = 0.48;
      confidence = 0.82;
      suggestedReaction = 'playfully_teasing';
      contextNotes = 'User is playfully teasing or bantering. Columbina answers with subtle knowing elegance and wit.';
    }
    // Priority 5: Compliments / Affection
    else if (isCompliment) {
      primaryEmotion = 'affectionate';
      intensity = 0.52;
      confidence = 0.86;
      suggestedReaction = 'soft_pleased';
      contextNotes = 'User pays a heartfelt compliment. Columbina responds with delicate modesty and calm allure.';
    }
    // Priority 6: Joking / Humor
    else if (isJoking || vocalSound === 'laugh') {
      primaryEmotion = 'amused';
      intensity = 0.5;
      confidence = 0.8;
      suggestedReaction = 'amused_witty';
      contextNotes = 'User cracked a joke or shared humor. Columbina shares a light, subtle smile.';
    }
    // Priority 7: Worried / Anxious
    else if (isWorriedOrAnxious || voiceAnalysis?.isShaky || vocalPrimary === 'hesitant') {
      primaryEmotion = 'worried';
      intensity = 0.6;
      confidence = 0.8;
      suggestedReaction = 'comforting_soothing';
      contextNotes = 'User feels nervous or anxious. Columbina offers serene, grounding reassurance.';
    }
    // Priority 8: Confusion / Uncertainty
    else if (isConfused) {
      primaryEmotion = 'confused';
      intensity = 0.42;
      confidence = 0.75;
      suggestedReaction = 'patient_explanatory';
      contextNotes = 'User is perplexed. Columbina clarifies with gentle patience and slight curious head tilt.';
    }
    // Priority 9: Serious intellectual / Philosophical question
    else if (isSeriousOrCurious && raw.length > 20) {
      primaryEmotion = 'curious';
      intensity = 0.45;
      confidence = 0.78;
      suggestedReaction = 'focused_intelligent';
      contextNotes = 'User asks a thoughtful inquiry. Columbina engages with deep intelligence and focus.';
    }
    // Priority 10: Casual Greeting / Farewell
    else if (isGreeting) {
      primaryEmotion = 'friendly';
      intensity = 0.38;
      confidence = 0.9;
      suggestedReaction = 'warm_gentle';
      contextNotes = 'User greeting. Columbina warmly acknowledges their presence.';
    } else if (isFarewell) {
      primaryEmotion = 'relieved';
      intensity = 0.4;
      confidence = 0.9;
      suggestedReaction = 'fond_farewell';
      contextNotes = 'User saying goodbye. Columbina bids farewell with gentle grace.';
    } else {
      primaryEmotion = 'calm';
      intensity = 0.3;
      confidence = 0.6;
      suggestedReaction = 'attentive_poised';
      contextNotes = 'Balanced conversational turn.';
    }

    return {
      primaryEmotion,
      intensity,
      confidence,
      secondaryEmotions,
      isQuestion: hasQuestionMark,
      isGreeting,
      isFarewell,
      isJoking,
      isTeasing,
      isCompliment,
      isUrgentOrDistressed: isSadOrLonely || isWorriedOrAnxious,
      isSeriousQuery: isSeriousOrCurious,
      suggestedColumbinaReaction: suggestedReaction,
      contextNotes,
    };
  }
}
