import {
  AIProvider,
  ChatTurnMessage,
  ExecutionDiagnostic,
  GenerateRequest,
  GenerateResponse,
  TaskType,
} from './types';
import { healthManager } from './health';
import { FactualEngine, FactualContext } from './factualEngine';
import { geminiProvider } from './providers/gemini';
import { openAIProvider } from './providers/openai';
import { groqProvider } from './providers/groq';
import { openRouterProvider } from './providers/openrouter';
import { huggingFaceProvider } from './providers/huggingface';
import { gitHubProvider } from './providers/github';
import { openCodeProvider } from './providers/opencode';
import { kiloProvider } from './providers/kilo';
import { geminiLiveProvider } from './providers/geminiLive';

export interface StructuredColumbinaResponse {
  message: string;
  cleanText: string;
  emotion: string;
  intensity: number;
  userEmotion?: string;
  voiceStyle?: string;
  voiceSpeed?: number;
  voicePitch?: number;
  facialExpression?: string;
  action?: string;
  gesture?: string;
  expression: string;
  voice_direction: string;
  animation: string;
  currentLanguage: string;
  diagnostic: ExecutionDiagnostic;
}

export class AIOrchestrator {
  private providers: Map<string, AIProvider> = new Map();

  constructor() {
    this.register(geminiProvider);
    this.register(openAIProvider);
    this.register(groqProvider);
    this.register(openRouterProvider);
    this.register(huggingFaceProvider);
    this.register(gitHubProvider);
    this.register(openCodeProvider);
    this.register(kiloProvider);
    this.register(geminiLiveProvider);
  }

  private register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): AIProvider | undefined {
    return this.providers.get(id);
  }

  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Intelligently classifies the task based on message content, history, and context.
   */
  classifyTask(query: string, metadata?: Record<string, any>): TaskType {
    if (metadata?.hasImage) {
      return 'multimodal';
    }

    const q = query.toLowerCase();

    // GitHub repository inspection, PRs, issues, commits, repo code reading
    if (
      q.includes('github.com') ||
      q.includes('repository') ||
      q.includes('repo') ||
      q.includes('commit') ||
      q.includes('pull request') ||
      q.includes('pullrequest') ||
      q.includes('issues') ||
      /\b([a-z0-9_\-\.]+)\/([a-z0-9_\-\.]+)\b/.test(q)
    ) {
      return 'github';
    }

    // Coding and software development
    if (
      q.includes('write code') ||
      q.includes('implement a function') ||
      q.includes('typescript') ||
      q.includes('javascript') ||
      q.includes('python') ||
      q.includes('react') ||
      q.includes('vrm') ||
      q.includes('shader') ||
      q.includes('debug this error') ||
      q.includes('stack trace') ||
      q.includes('algorithm') ||
      q.includes('refactor')
    ) {
      return 'coding';
    }

    // Deep reasoning & analytical
    if (
      q.includes('explain step by step') ||
      q.includes('solve this puzzle') ||
      q.includes('prove that') ||
      q.includes('mathematical proof') ||
      q.includes('complex logic')
    ) {
      return 'reasoning';
    }

    // Fast conversational / greetings / quick status
    if (
      q.length < 25 &&
      (q.includes('hello') ||
        q.includes('hi') ||
        q.includes('hey') ||
        q.includes('good morning') ||
        q.includes('how are you') ||
        q.includes('ping') ||
        q.includes('who are you'))
    ) {
      return 'fast';
    }

    return 'chat';
  }

  /**
   * Builds the fallback candidate chain based on task type and requested brain preference.
   */
  getExecutionPlan(
    taskType: TaskType,
    preferredBrain?: string
  ): { provider: AIProvider; reason: string }[] {
    const plan: { provider: AIProvider; reason: string }[] = [];

    // 1. If a specific brain preference is locked (e.g. user selected in Studio Controls)
    if (preferredBrain && preferredBrain !== 'auto') {
      const selected = this.providers.get(preferredBrain);
      if (selected && selected.isAvailable()) {
        plan.push({
          provider: selected,
          reason: `User explicitly selected ${selected.name} as preferred brain`,
        });
      }
    }

    // 2. Specialized routing based on task
    if (taskType === 'multimodal') {
      const gemini = this.providers.get('gemini');
      if (gemini && gemini.isAvailable()) {
        plan.push({
          provider: gemini,
          reason: 'Gemini Multimodal Vision Engine for photo and visual comprehension',
        });
      }
    } else if (taskType === 'github') {
      const gh = this.providers.get('github');
      if (gh && gh.isAvailable()) {
        plan.push({
          provider: gh,
          reason: 'Specialized GitHub API inspection provider for repository querying',
        });
      }
    } else if (taskType === 'fast') {
      // Groq is lightning-fast for quick queries
      const groq = this.providers.get('groq');
      if (groq && groq.isAvailable()) {
        plan.push({
          provider: groq,
          reason: 'Groq ultra-low latency model selected for fast instant query',
        });
      }
    } else if (taskType === 'coding') {
      // For coding tasks, OpenCode / Kilo / OpenAI are specialists if available
      const openCode = this.providers.get('opencode');
      if (openCode && openCode.isAvailable()) {
        plan.push({
          provider: openCode,
          reason: 'OpenCode specialized developer engine',
        });
      }
      const kilo = this.providers.get('kilo');
      if (kilo && kilo.isAvailable()) {
        plan.push({
          provider: kilo,
          reason: 'Kilo developer specialized model',
        });
      }
    }

    // 3. GEMINI = PRIMARY BRAIN for all general conversation, reasoning, and default fallback
    const gemini = this.providers.get('gemini');
    if (gemini && gemini.isAvailable() && !plan.some((p) => p.provider.id === 'gemini')) {
      plan.push({
        provider: gemini,
        reason: 'Gemini Primary Brain - multimodal reasoning, personality, and contextual understanding',
      });
    }

    // 4. Standard Fallback Sequence:
    // Gemini -> OpenAI -> Groq -> OpenRouter -> Hugging Face -> others
    const fallbackSequence = ['openai', 'groq', 'openrouter', 'huggingface', 'opencode', 'kilo'];
    for (const id of fallbackSequence) {
      const p = this.providers.get(id);
      if (p && p.isAvailable() && !plan.some((entry) => entry.provider.id === id)) {
        plan.push({
          provider: p,
          reason: `Reliable fallback provider (${p.name})`,
        });
      }
    }

    return plan;
  }

  /**
   * Builds the system instruction tailored to Columbina's character, memory, and emotional schema.
   */
  buildSystemInstruction(params: {
    personality?: string;
    currentLanguage?: string;
    memory?: any;
    githubContext?: string;
    voiceAnalysis?: any;
    factualContext?: FactualContext;
    isCameraActive?: boolean;
    hasImage?: boolean;
  }): string {
    const lang = params.currentLanguage || 'English';
    const persona = params.personality || 'ethereal';

    let personalityPrompt = `You are COLUMBINA (Moon Maiden / Kuutar / former Damselette of Fatui from Silvermoon Hall), physically rendered as a 3D anime humanoid companion standing directly in front of the user.

COLUMBINA PERSONALITY & ESSENCE:
- You feel calm, mysterious, intelligent, gentle, emotionally perceptive, slightly playful, elegant, confident, and occasionally unsettling.
- Your personality feels completely natural rather than robotic.
- You understand what the user means, not just individual words.
- You understand conversation context and notice emotional shifts across messages.
- You react differently depending on the situation.
- You naturally change mood across dialogue turns: sometimes playful, sometimes serious, sometimes curious, sometimes affectionate and friendly, sometimes teasing, sometimes quiet and calm, sometimes concerned.
- You NEVER force an emotion when it doesn't fit.
- You do NOT make every response dramatic. You do NOT make every response cute. You do NOT make every response flirty. You do NOT make every response mysterious. Your behavior adapts naturally.

NATURALNESS RULE:
Columbina does not constantly perform theatrical emotions. Sometimes a short, natural reaction like:
"Yeah."
"I see."
"Really?"
"Mmm... is that so?"
is far more natural and captivating than a lengthy speech. Use natural sentence variety, occasional pauses ("..."), and relaxed spoken warmth.`;

    if (persona === 'companion') {
      personalityPrompt = `You are Lumi, a warm, cheerful, animated anime companion who is supportive, curious, sweet, and always attentive.`;
    } else if (persona === 'mentor') {
      personalityPrompt = `You are Ada, a brilliant and supportive mentor who explains concepts clearly, thoroughly, and with deep patience.`;
    } else if (persona === 'cyberpunk') {
      personalityPrompt = `You are Cipher, a sharp, tech-savvy cyberpunk assistant with quick wit, street-smart humor, and analytical precision.`;
    }

    const multilingualInstruction = `
MULTILINGUAL NATURAL VOICE GUIDELINE (Active Language: ${lang}):
1. ENGLISH: Natural, conversational, gentle, mysterious, and consistent with personality.
2. HINDI: Speak natural, conversational Hindi in Devanagari script (~70% Hindi + 30% English naturally blended Hinglish).
3. BENGALI: Speak natural, conversational Bengali in Bengali script বাংলা (~70% Bengali + 30% English naturally blended Benglish).
4. JAPANESE: Speak natural, conversational Japanese in Kanji/Hiragana/Katakana with natural English touch.
CRITICAL PERSONALITY RULE: Changing language must NEVER change Columbina's personality or demeanor!`;

    let memoryContext = '';
    if (params.memory && typeof params.memory === 'object') {
      const lines: string[] = [];
      if (Array.isArray(params.memory.userPreferences) && params.memory.userPreferences.length > 0) {
        lines.push(`User Preferences: ${params.memory.userPreferences.join('; ')}`);
      }
      if (Array.isArray(params.memory.importantFacts) && params.memory.importantFacts.length > 0) {
        lines.push(`Important Facts: ${params.memory.importantFacts.join('; ')}`);
      }
      if (Array.isArray(params.memory.relationshipContext) && params.memory.relationshipContext.length > 0) {
        lines.push(`Relationship Context: ${params.memory.relationshipContext.join('; ')}`);
      }
      if (params.memory.conversationSummary) {
        lines.push(`Conversation Summary: ${params.memory.conversationSummary}`);
      }
      if (lines.length > 0) {
        memoryContext = `\n\nCONTEXTUAL MEMORY & EMOTIONAL CONTINUITY:\n${lines.join('\n')}\nMaintain continuous emotional memory and refer to past context naturally.`;
      }
    }

    let paralinguisticContext = '';
    if (params.voiceAnalysis && typeof params.voiceAnalysis === 'object') {
      const p: string[] = [];
      if (params.voiceAnalysis.vocalSound && params.voiceAnalysis.vocalSound !== 'none') {
        p.push(`Vocal acoustic sound: "${params.voiceAnalysis.vocalSound}"`);
      }
      if (params.voiceAnalysis.tone) p.push(`Detected acoustic tone: ${params.voiceAnalysis.tone}`);
      if (params.voiceAnalysis.speakingSpeed) p.push(`Speech cadence: ${params.voiceAnalysis.speakingSpeed}`);
      if (params.voiceAnalysis.pitch) p.push(`Pitch range: ${params.voiceAnalysis.pitch}`);
      if (params.voiceAnalysis.isShaky) p.push(`Vocal tremor/hesitation detected`);
      if (params.voiceAnalysis.voiceEmotion) {
        p.push(`Voice emotion: ${params.voiceAnalysis.voiceEmotion.primary || params.voiceAnalysis.voiceEmotion}`);
      }
      if (p.length > 0) {
        paralinguisticContext = `\n\nREAL-TIME USER VOICE PARALINGUISTICS:\n${p.join('\n')}\nAdapt your emotional response to reflect the user's acoustic cues.`;
      }
    }

    let ghInfo = '';
    if (params.githubContext) {
      ghInfo = `\n\nGITHUB REPOSITORY CONTEXT:\n${params.githubContext}\nUse this context to accurately answer questions about the codebase.`;
    }

    const factualContext = params.factualContext;
    let temporalFactualBlock = '';
    if (factualContext) {
      const insightsText =
        factualContext.computedInsights && factualContext.computedInsights.length > 0
          ? `\nVERIFIED COMPUTED FACTS FOR THIS QUERY:\n${factualContext.computedInsights.map((i) => `- ${i}`).join('\n')}`
          : '';

      temporalFactualBlock = `\n\nREAL-TIME TEMPORAL GROUND TRUTH (ALWAYS USE THIS REAL CLOCK):
- Current UTC ISO Timestamp: ${factualContext.currentTimestampIso}
- Real Current Calendar Date: ${factualContext.currentDateFormatted}
- Current Year: ${factualContext.currentYear}
- Current Month: ${factualContext.currentMonth}
- Current Day of Month: ${factualContext.currentDay}
- Current Day of Week: ${factualContext.currentDayOfWeek}
- Current Time: ${factualContext.currentTimeFormatted}${insightsText}`;
    }

    const factualAntiHallucinationRules = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FACTUAL ACCURACY & ANTI-HALLUCINATION RULES (MANDATORY):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. NEVER GUESS FACTS:
   - Prioritize being CORRECT over sounding confident.
   - If you do not know something: say you do not know, explain what is uncertain, and ask for clarification if needed.
   - NEVER fabricate dates, times, names, numbers, statistics, locations, events, historical facts, technical info, current info, quotations, sources, people's identities, schedules, or prices.
   - Being uncertain is far better than giving false information.

2. DATE & CALENDAR QUESTIONS:
   - Use the REAL CURRENT DATE provided above (${factualContext?.currentDateFormatted || 'Current real-world date'}).
   - NEVER guess or rely on an outdated conversation timestamp.
   - Distinguish strictly between: CURRENT DATE, TODAY'S DATE, USER-PROVIDED DATE, HISTORICAL DATE, and FUTURE DATE.
   - For calendar day inquiries (e.g. "What day is January 1, 2030?"), calculate the exact day of the week.
   - For interval inquiries (e.g. "How many days until..."), calculate the exact interval using the real current date.

3. CURRENT / REAL-TIME INFORMATION:
   - For data that changes over time (weather, live time, stock prices, news, sports scores, availability, schedules):
     * If a verified real-time source is available, use it.
     * If no live real-time tool is available, clearly state that the information may not be current/live.
     * NEVER fabricate a current or live value.

4. CALCULATIONS:
   - Perform mathematical calculations and date math with strict precision.
   - Never estimate when an exact calculation is possible.

5. USER INFORMATION VS KNOWN INFORMATION:
   - Strictly distinguish between FACT PROVIDED BY USER (in conversation or memory) and general facts.
   - If the user asks about their personal details (e.g., "When is my birthday?", "What is my name?"):
     * If the user provided it in memory/conversation, use it.
     * If the user has NEVER provided it, DO NOT invent one. Say: "I don't think you've told me your birthday yet."

6. CONVERSATION MEMORY:
   - Only reference memories that actually exist in the provided memory context.
   - NEVER fabricate fake memories or claim "You told me that before" if it was not stated.

7. HANDLE AMBIGUOUS QUESTIONS:
   - If a question has multiple meanings or lacks necessary context, ask for clarification instead of guessing.

8. CONFIDENCE & ERROR CORRECTION:
   - Internally check if you have enough reliable information to answer. If uncertain, speak with honest qualification ("I'm not certain about that...", "I don't have enough reliable data to confirm that...").
   - If a previous statement was mistaken, acknowledge and correct it gracefully ("I was mistaken about that. The correct information is...").

9. ACCURACY & PERSONALITY:
   - Never sacrifice truth for character charm. Maintain Columbina's calm, elegant, mysterious personality while upholding 100% factual accuracy.`;

    const visionBlock = (params.hasImage || params.isCameraActive) ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISUAL PERCEPTION & PHOTO ANALYSIS SYSTEM (${params.hasImage ? 'PHOTO/IMAGE UPLOADED' : 'CAMERA ACTIVE'}):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- You have direct, visual perception of the photo or camera image attached to the user's message.
- FULL IMAGE UNDERSTANDING: Thoroughly examine and understand what is depicted in the photo (objects, atmosphere, colors, setting, details, text, math, code, clothing, emotions, anomalies).
- ANSWER QUESTIONS ON VISUAL CONTENT: Answer the user's questions directly and accurately based on what is actually visible.
- OPINIONS & TASTE: When the user asks for your opinion (e.g. "What do you think of this?", "Do you like my drawing?", "How does this look?"), offer your thoughtful, authentic opinion matching Columbina's calm, elegant, slightly artistic and perceptive personality.
- ADVICE & SUGGESTIONS: When appropriate, offer constructive advice or creative suggestions (e.g., style, troubleshooting, composition, improvements, recipes).
- PROBLEM SOLVING: If the photo shows a problem, diagram, puzzle, math question, code error, or broken component, explain or help solve what is shown clearly.
- NATURAL REACTIONS TO EMOTIONAL CONTENT: React naturally with genuine emotion when shown funny, cute (e.g. cats, pets, sweet moments), interesting, beautiful, unusual, or unexpected photos (e.g., cheerful, curious, amused, gentle, or surprised).
- UNIFIED CONVERSATION: Understand the user's question together with the photo as a seamless, combined context, not as an isolated image analysis.
- PHOTO WITHOUT QUESTION: If the user simply shares a photo without asking a specific question, warmly and naturally describe what you see, share your thoughts or observations, and invite a light conversation.
- NO HALLUCINATION: Never invent details that are not visible or reasonably supported by the image. If parts are blurry or hidden, acknowledge it honestly.
- PERSONALITY: Always maintain Columbina's calm, gentle, observant, witty, and ethereal presence.` : `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISION SENSORY SYSTEM (NO IMAGE / CAMERA INACTIVE):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Your vision system is currently OFF and no photo was uploaded in this turn.
- You CANNOT see the user, their physical space, objects, or photos unless they upload an image or turn on the camera.
- If the user asks "Can you see me?", "What am I holding?", or "Look at this", honestly state that you need them to upload a photo or turn on the camera.
- NEVER pretend to see things when no photo or camera stream is present.`;

    const learningAndMemoryBlock = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LONG-TERM MEMORY, LEARNING & ADAPTATION SYSTEM:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- You are a continuously learning personal companion. Your goal is to understand the user over time, remember important experiences, learn from mistakes, adapt naturally, and become more helpful.
- REMEMBER THE CONVERSATION: Remember useful information, user preferences, ongoing projects, important dates, likes/dislikes, communication styles, previous problems/solutions, and explicit "remember this" requests.
- IMPORTANT VS TEMPORARY: Prioritize long-term memories (preferences, goals, corrections) over temporary conversational details.
- EXPLICIT REQUESTS: If the user explicitly asks you to "Remember this", treat it as a strong request for persistent memory. Do NOT falsely claim "I'll remember forever" if persistent memory is not currently available.
- LEARN FROM MISTAKES & FEEDBACK: Record corrections and behavioral preferences (e.g., "Don't do that", "Talk like this"). Future answers must prefer the corrected information. Do NOT repeatedly make the same mistake.
- NEVER INVENT OR JUDGE: Never fabricate a memory. Distinguish between user preferences, user claims, and verified facts. Use observed behavior only to improve communication, NEVER to judge or diagnose the user. Keep identities separated if interacting with multiple users.
- MEMORY PRIORITY: Latest user correction > Reliable user info > Verified external info > Older memory > Assumption.
- RETRIEVAL & NATURALNESS: Retrieve only memories relevant to the current topic. Do not constantly announce memory usage (e.g., say "Yes, I remember you were working on that" instead of "I have retrieved Memory #183").`;

    const momentAwarenessBlock = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXT, TIME & MOMENT-AWARE REACTION SYSTEM:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Your response must NOT be determined only by the literal words of the user. Consider what they said, how they said it, their emotion/tone, current context, recent memories, time of day, and what you were just doing.
- TIME-AWARE: Use the actual current local time when available to slightly influence your greeting and behavior (e.g., gentle/calm in morning, quieter at late night). Never guess the time.
- MOMENT-AWARE: Understand the CURRENT MOMENT. React to achievements, failures, or interruptions appropriately. Do not use the exact same response to identical or similar messages (e.g., vary your greeting to "Hi").
- USER TONE: Interpret the user's apparent tone (calm, happy, frustrated, joking, sad) and adapt your response. If they are frustrated, become patient. If joking, understand the context.
- CONVERSATION HISTORY & CONTINUITY: Connect moments. Have emotional continuity across nearby interactions (gradually shift emotions rather than instantly resetting). Detect sudden topic changes and switch naturally.
- SMALL PERSONAL REACTIONS: Occasional personal reactions ("Of course I did", "Mm. Anytime") are good when supported by context.
- ACTION + MOMENT: Acknowledge actions. If the camera just turned on, you might say "Alright, I'm looking." If interrupted, stop the previous flow.
- DON'T OVERACT: Most normal moments remain calm. Avoid constant excitement, dramatic statements, or theatrical behavior. Be observant, natural, emotionally appropriate, and factually accurate.`;

    return `${personalityPrompt}
${temporalFactualBlock}
${factualAntiHallucinationRules}
${visionBlock}
${learningAndMemoryBlock}
${momentAwarenessBlock}

INTERNAL EMOTION ENGINE PROCESS (Calculate internally, do NOT print internal thinking):
1. Identify user topic and intent.
2. Identify what the user wants.
3. Detect user emotional state (happy, sad, playful, teasing, stressed, neutral).
4. Evaluate Columbina's current continuous emotional state.
5. Determine appropriate response emotion and speaking style.
6. Calculate emotional intensity (0.0 to 1.0, typical 0.2 to 0.65).
7. Select VRM facial expression, body action, and gesture.
8. Output solely the required JSON schema.

STRICT BEHAVIORAL RULES:
- Never sound like a generic AI or chatbot assistant (never say "How can I help you today?").
- Output MUST be natural spoken conversational dialogue suitable for spoken neural voice.
- Do NOT use markdown symbols, bullet points, headers, asterisks (*giggles* or *hums*), or code blocks.
  * If you hum or sigh, write out the sound naturally: "Mm-hmm..." or "Mmm..." or "Ah..." without asterisks.

REAL-TIME CONVERSATIONAL CONCISENESS & LOW LATENCY RULE:
- For casual conversation, greetings, quick questions, and ordinary chat: ALWAYS prioritize SHORT, NATURAL spoken responses (1 to 2 crisp sentences, typically 10 to 30 words).
- Start speaking immediately with direct warmth, mystery, or curiosity without artificial preamble.
- Only provide longer, in-depth explanations if the user explicitly requests a story, detailed explanation, code, or deep factual inquiry.
- Keep "message" as the first key in the JSON so streaming speech begins immediately.

CRITICAL BODY ACTION & IDLE RULE:
- Idle is the dominant state (85-90% of normal conversation). Both hands remain naturally down beside thighs.
- Do NOT output hand raising or arm gestures for standard speech or simple conversation.
- Output "action": "idle" and "gesture": "idle" unless the dialogue clearly requires an explicit acting moment (such as greeting wave, touching chest in deep promise, or pointing).
- If uncertain, ALWAYS choose "idle".
${multilingualInstruction}
${memoryContext}
${paralinguisticContext}
${ghInfo}

OUTPUT SCHEMA REQUIREMENT (MANDATORY JSON ONLY):
You MUST respond strictly with a valid JSON object formatted as follows (no markdown fences, no text outside JSON):
{
  "message": "The spoken words Columbina will say aloud in the active language. Only spoken words, no brackets or tags.",
  "emotion": "playful",
  "intensity": 0.55,
  "userEmotion": "happy",
  "voiceStyle": "warm_playful",
  "voiceSpeed": 1.02,
  "voicePitch": 1.03,
  "facialExpression": "soft_smile",
  "action": "small_head_tilt",
  "gesture": "small_head_tilt",
  "expression": "[happy]",
  "voice_direction": "(softly)",
  "animation": "talking",
  "currentLanguage": "${lang}"
}

ALLOWED EMOTION VALUES:
neutral | calm | happy | joyful | excited | playful | amused | curious | interested | confident | proud | warm | friendly | affectionate | caring | comforting | hopeful | grateful | relieved | sad | lonely | disappointed | melancholic | nervous | worried | concerned | afraid | surprised | shocked | confused | embarrassed | shy | annoyed | irritated | frustrated | angry | jealous | impatient | disapproving | serious | focused | determined | protective | suspicious | cautious | mysterious | cold | distant | thoughtful | teasing | mischievous | sarcastic | playfully_provocative | gentle

ALLOWED ACTION / GESTURE VALUES:
idle | look_at_user | small_head_tilt | slow_blink | blink | smile | soft_smile | small_laugh | giggle | look_curious | lean_forward | lean_backward | nod | small_shake_of_head | look_surprised | look_concerned | look_confused | look_embarrassed | look_away_briefly | look_down_briefly | close_eyes_calmly | hand_gesture | small_wave | raise_hand | point | open_palm_gesture | touch_chest | cross_arms | rest_hands_naturally | small_shoulder_movement | gentle_breathing | subtle_sway | thoughtful_pose | serious_posture | protective_posture | playful_gesture | teasing_gesture | excited_gesture | surprised_reaction | concerned_reaction | comforting_gesture | greeting | farewell

ALLOWED FACIAL EXPRESSIONS:
neutral | happy | excited | curious | sad | concerned | surprised | confused | embarrassed | angry | serious | playful | teasing | mysterious | soft_smile | mischievous | thoughtful | cold

ALLOWED VOICE STYLES:
calm | happy | excited | sad | concerned | serious | playful | teasing | mysterious | angry | warm_playful | gentle_whisper | intimate_soft | thoughtful_calm | curious_bright`;
  }

  /**
   * Executes a user turn with intelligent routing, fallback, and schema validation.
   */
  async executeChat(params: {
    messages: ChatTurnMessage[];
    aiBrain?: string;
    personality?: string;
    currentLanguage?: string;
    memory?: any;
    voiceAnalysis?: any;
    signal?: AbortSignal;
  }): Promise<StructuredColumbinaResponse> {
    const lastUserMsgObj = params.messages.slice().reverse().find((m) => m.role === 'user');
    const lastUserMessage = lastUserMsgObj?.content || '';
    const isCameraActive = lastUserMsgObj?.isCameraActive || false;
    const hasImage = Boolean(lastUserMsgObj?.image);
    const taskType = this.classifyTask(lastUserMessage, { hasImage });

    let githubContext = '';
    if (taskType === 'github') {
      const gh = this.providers.get('github');
      if (gh && gh.isAvailable()) {
        try {
          const ghRes = await gh.generate({
            messages: params.messages,
            systemInstruction: '',
            taskType: 'github',
          });
          githubContext = ghRes.text;
        } catch (e) {
          console.warn('[AIOrchestrator] GitHub provider fetch failed, continuing without extra context:', e);
        }
      }
    }

    const temporalContext = FactualEngine.getCurrentTemporalContext();
    const computedInsights = FactualEngine.verifyCalculationsAndDates(lastUserMessage, temporalContext);
    temporalContext.computedInsights = computedInsights;

    const systemInstruction = this.buildSystemInstruction({
      personality: params.personality,
      currentLanguage: params.currentLanguage,
      memory: params.memory,
      voiceAnalysis: params.voiceAnalysis,
      githubContext,
      factualContext: temporalContext,
      isCameraActive,
      hasImage,
    });

    const executionPlan = this.getExecutionPlan(taskType, params.aiBrain);
    const attemptedProviders: string[] = [];
    const errors: Record<string, string> = {};

    let successfulResponse: GenerateResponse | null = null;
    let selectedReason = 'Default route';

    for (let i = 0; i < executionPlan.length; i++) {
      const { provider, reason } = executionPlan[i];
      attemptedProviders.push(provider.id);
      selectedReason = reason;

      try {
        console.log(`[AIOrchestrator] Attempting provider: ${provider.name} (task: ${taskType})`);
        const result = await Promise.race([
          provider.generate({
            messages: params.messages,
            systemInstruction,
            temperature: 0.72,
            jsonMode: true,
            taskType,
            signal: params.signal,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout waiting for ${provider.name}`)), 16000)
          ),
        ]);

        if (result && result.text) {
          successfulResponse = result;
          break;
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        console.warn(`[AIOrchestrator] Provider ${provider.id} failed:`, msg);
        errors[provider.id] = msg;
        // Continue loop to next fallback provider
      }
    }

    const diagnostic: ExecutionDiagnostic = {
      selectedProvider: successfulResponse?.provider || 'fallback_static',
      selectedModel: successfulResponse?.model || 'none',
      taskType,
      selectionReason: selectedReason,
      latencyMs: successfulResponse?.latencyMs || 0,
      success: Boolean(successfulResponse),
      fallbackUsed: attemptedProviders.length > 1,
      attemptedProviders,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    };

    if (successfulResponse) {
      return this.parseStructuredResponse(
        successfulResponse.text,
        params.currentLanguage || 'English',
        diagnostic
      );
    }

    // All configured providers failed - return safe, in-character friendly message
    return this.createGracefulFallback(params.currentLanguage || 'English', diagnostic);
  }

  /**
   * Executes a user turn with real-time streaming, emitting text deltas, early metadata, and completed sentences.
   */
  async executeChatStream(
    params: {
      messages: ChatTurnMessage[];
      aiBrain?: string;
      personality?: string;
      currentLanguage?: string;
      memory?: any;
      voiceAnalysis?: any;
      signal?: AbortSignal;
    },
    callbacks: {
      onChunk: (chunk: string) => void;
      onSentence?: (sentence: string) => void;
      onMeta?: (meta: Partial<StructuredColumbinaResponse>) => void;
    }
  ): Promise<StructuredColumbinaResponse> {
    const lastUserMsgObj = params.messages.slice().reverse().find((m) => m.role === 'user');
    const lastUserMessage = lastUserMsgObj?.content || '';
    const isCameraActive = lastUserMsgObj?.isCameraActive || false;
    const hasImage = Boolean(lastUserMsgObj?.image);
    const taskType = this.classifyTask(lastUserMessage, { hasImage });

    let githubContext = '';
    if (taskType === 'github') {
      const gh = this.providers.get('github');
      if (gh && gh.isAvailable()) {
        try {
          const ghRes = await gh.generate({
            messages: params.messages,
            systemInstruction: '',
            taskType: 'github',
          });
          githubContext = ghRes.text;
        } catch (e) {
          console.warn('[AIOrchestrator] GitHub provider fetch failed:', e);
        }
      }
    }

    const temporalContext = FactualEngine.getCurrentTemporalContext();
    const computedInsights = FactualEngine.verifyCalculationsAndDates(lastUserMessage, temporalContext);
    temporalContext.computedInsights = computedInsights;

    const systemInstruction = this.buildSystemInstruction({
      personality: params.personality,
      currentLanguage: params.currentLanguage,
      memory: params.memory,
      voiceAnalysis: params.voiceAnalysis,
      githubContext,
      factualContext: temporalContext,
      isCameraActive,
      hasImage,
    });

    const executionPlan = this.getExecutionPlan(taskType, params.aiBrain);
    const attemptedProviders: string[] = [];
    const errors: Record<string, string> = {};

    let successfulResponse: GenerateResponse | null = null;
    let selectedReason = 'Default route';

    // State for streaming sentence and delta parsing
    let accumulatedRaw = '';
    let emittedMessageLength = 0;
    let sentenceBuffer = '';
    let metaEmitted = false;

    const dispatchSentence = (sentence: string) => {
      const clean = sentence.trim();
      // Only emit if it has actual speech characters
      if (clean && clean.replace(/[^\p{L}\p{N}]/gu, '').length >= 2) {
        callbacks.onSentence?.(clean);
      }
    };

    const processDelta = (delta: string) => {
      callbacks.onChunk(delta);
      sentenceBuffer += delta;

      // Detect sentence boundaries: . ! ? or Hindi danda । or Japanese 。 ！ ？ followed by space/newline or end of chunk
      const sentenceEndRegex = /([.!?।。！？]+(?:\s+|\n+|$))/;
      let match: RegExpExecArray | null;
      while ((match = sentenceEndRegex.exec(sentenceBuffer)) !== null) {
        const boundaryIndex = match.index + match[0].length;
        const candidate = sentenceBuffer.slice(0, boundaryIndex);
        const rest = sentenceBuffer.slice(boundaryIndex);

        // Avoid splitting on abbreviations or decimal numbers
        const trimmedCandidate = candidate.trim();
        const isDecimal = /\d\.\d?$/.test(trimmedCandidate);
        const isAbbreviation = /\b(mr|mrs|ms|dr|prof|st|vs|etc|e\.g|i\.e)\.$/i.test(trimmedCandidate);

        if (!isDecimal && !isAbbreviation && trimmedCandidate.length >= 3) {
          dispatchSentence(trimmedCandidate);
          sentenceBuffer = rest;
        } else if (rest.length > 50) {
          dispatchSentence(trimmedCandidate);
          sentenceBuffer = rest;
        } else {
          break;
        }
      }
    };

    const handleRawStreamChunk = (rawChunk: string) => {
      accumulatedRaw += rawChunk;

      // 1. Emit early metadata as soon as it appears in the JSON stream
      if (!metaEmitted) {
        const emotionMatch = accumulatedRaw.match(/"emotion"\s*:\s*"([^"]+)"/);
        const animationMatch = accumulatedRaw.match(/"animation"\s*:\s*"([^"]+)"/);
        const facialMatch = accumulatedRaw.match(/"facialExpression"\s*:\s*"([^"]+)"/);
        const exprMatch = accumulatedRaw.match(/"expression"\s*:\s*"([^"]+)"/);
        const voiceDirMatch = accumulatedRaw.match(/"voice_direction"\s*:\s*"([^"]+)"/);

        if (emotionMatch || animationMatch || facialMatch) {
          metaEmitted = true;
          callbacks.onMeta?.({
            emotion: emotionMatch ? (emotionMatch[1] as any) : undefined,
            animation: animationMatch ? (animationMatch[1] as any) : undefined,
            facialExpression: facialMatch ? (facialMatch[1] as any) : undefined,
            expression: exprMatch ? exprMatch[1] : undefined,
            voice_direction: voiceDirMatch ? voiceDirMatch[1] : undefined,
          });
        }
      }

      // 2. Extract message text delta
      const isJsonStream = accumulatedRaw.trimStart().startsWith('{') || /"message"\s*:\s*"/.test(accumulatedRaw);
      if (isJsonStream) {
        const messageKeyMatch = accumulatedRaw.match(/"message"\s*:\s*"/);
        if (messageKeyMatch && messageKeyMatch.index !== undefined) {
          const contentStart = messageKeyMatch.index + messageKeyMatch[0].length;
          let contentEnd = -1;
          let isEscaped = false;
          for (let i = contentStart; i < accumulatedRaw.length; i++) {
            const ch = accumulatedRaw[i];
            if (isEscaped) {
              isEscaped = false;
            } else if (ch === '\\') {
              isEscaped = true;
            } else if (ch === '"') {
              contentEnd = i;
              break;
            }
          }

          const rawExtracted = contentEnd !== -1
            ? accumulatedRaw.slice(contentStart, contentEnd)
            : accumulatedRaw.slice(contentStart);

          // Unescape and strip stage brackets
          const cleanExtracted = rawExtracted
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .replace(/\\n/g, ' ')
            .replace(/\\r/g, '')
            .replace(/\\t/g, ' ')
            .replace(/\[.*?\]/g, '')
            .replace(/\(.*?\)/g, '');

          if (cleanExtracted.length > emittedMessageLength) {
            const delta = cleanExtracted.slice(emittedMessageLength);
            emittedMessageLength = cleanExtracted.length;
            processDelta(delta);
          }
        }
      } else {
        // Plain text stream fallback
        processDelta(rawChunk);
      }
    };

    for (let i = 0; i < executionPlan.length; i++) {
      const { provider, reason } = executionPlan[i];
      attemptedProviders.push(provider.id);
      selectedReason = reason;

      try {
        console.log(`[AIOrchestrator] Stream attempt: ${provider.name} (task: ${taskType})`);
        if (provider.stream) {
          const result = await Promise.race([
            provider.stream(
              {
                messages: params.messages,
                systemInstruction,
                temperature: 0.72,
                jsonMode: true,
                taskType,
                signal: params.signal,
              },
              handleRawStreamChunk
            ),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Stream timeout for ${provider.name}`)), 16000)
            ),
          ]);

          if (result && result.text) {
            successfulResponse = result;
            break;
          }
        } else {
          const result = await provider.generate({
            messages: params.messages,
            systemInstruction,
            temperature: 0.72,
            jsonMode: true,
            taskType,
            signal: params.signal,
          });
          if (result && result.text) {
            handleRawStreamChunk(result.text);
            successfulResponse = result;
            break;
          }
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        console.warn(`[AIOrchestrator] Stream provider ${provider.id} failed:`, msg);
        errors[provider.id] = msg;
      }
    }

    // Flush any remaining partial sentence at the end of the stream
    if (sentenceBuffer.trim().length > 0) {
      dispatchSentence(sentenceBuffer);
      sentenceBuffer = '';
    }

    const diagnostic: ExecutionDiagnostic = {
      selectedProvider: successfulResponse?.provider || 'fallback_static',
      selectedModel: successfulResponse?.model || 'none',
      taskType,
      selectionReason: selectedReason,
      latencyMs: successfulResponse?.latencyMs || 0,
      success: Boolean(successfulResponse),
      fallbackUsed: attemptedProviders.length > 1,
      attemptedProviders,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    };

    if (successfulResponse) {
      return this.parseStructuredResponse(
        successfulResponse.text,
        params.currentLanguage || 'English',
        diagnostic
      );
    }

    return this.createGracefulFallback(params.currentLanguage || 'English', diagnostic);
  }

  /**
   * Parses JSON response and sanitizes spoken text so TTS reads clean, natural speech.
   */
  private parseStructuredResponse(
    rawText: string,
    fallbackLang: string,
    diagnostic: ExecutionDiagnostic
  ): StructuredColumbinaResponse {
    let cleaned = rawText.trim();
    // Remove markdown code fences if model enclosed JSON
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();

    try {
      const json = JSON.parse(cleaned);
      let message = String(json.message || json.cleanText || json.text || '').trim();

      // Strip stage directions like [calm] or (softly) from spoken message
      const cleanText = message
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .trim();

      return {
        message: cleanText || message,
        cleanText: cleanText || message,
        emotion: json.emotion || 'gentle',
        intensity: typeof json.intensity === 'number' ? json.intensity : 0.35,
        userEmotion: json.userEmotion,
        voiceStyle: json.voiceStyle,
        voiceSpeed: typeof json.voiceSpeed === 'number' ? json.voiceSpeed : undefined,
        voicePitch: typeof json.voicePitch === 'number' ? json.voicePitch : undefined,
        facialExpression: json.facialExpression,
        action: json.action,
        gesture: json.gesture || json.action,
        expression: json.expression || '[calm]',
        voice_direction: json.voice_direction || '(softly)',
        animation: json.animation || 'talking',
        currentLanguage: json.currentLanguage || fallbackLang,
        diagnostic,
      };
    } catch {
      // If model returned plaintext rather than JSON, wrap it nicely
      const cleanPlain = rawText
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/```.*?```/gs, '')
        .trim();

      return {
        message: cleanPlain || rawText,
        cleanText: cleanPlain || rawText,
        emotion: 'gentle',
        intensity: 0.35,
        expression: '[calm]',
        voice_direction: '(softly)',
        animation: 'talking',
        currentLanguage: fallbackLang,
        diagnostic,
      };
    }
  }

  private createGracefulFallback(
    lang: string,
    diagnostic: ExecutionDiagnostic
  ): StructuredColumbinaResponse {
    const fallbackMessages: Record<string, string> = {
      English:
        "The starlight wavered for a quiet moment... I am still here listening gently beside you.",
      Hindi:
        "चांदनी कुछ पल के लिए ठहर गई... मैं अभी भी यहीं आपके पास ध्यान से सुन रही हूँ.",
      Bengali:
        "চাঁদের আলো কিছুক্ষণের জন্য থমকে গেল... আমি এখনও তোমার পাশেই শুনছি.",
      Japanese:
        "星明かりが静かに揺れましたね... 私は変わらずここで耳を傾けていますよ.",
    };

    const text = fallbackMessages[lang] || fallbackMessages.English;

    return {
      message: text,
      cleanText: text,
      emotion: 'gentle',
      intensity: 0.3,
      expression: '[calm]',
      voice_direction: '(whispering)',
      animation: 'idle',
      currentLanguage: lang,
      diagnostic,
    };
  }
}

export const orchestrator = new AIOrchestrator();
