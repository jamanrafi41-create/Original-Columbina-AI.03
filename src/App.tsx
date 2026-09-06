/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VRMViewer } from './components/VRMViewer';
import { EtherealDialogueBar } from './components/EtherealDialogueBar';
import { AuthStatusHeader } from './components/AuthStatusHeader';
import { audioService } from './services/audioService';
import { memoryService } from './services/memoryService';
import { cameraVisionService } from './services/cameraVisionService';
import { firebaseService, auth, UserProfileData } from './services/firebaseService';
import { onAuthStateChanged } from 'firebase/auth';
import { CameraVisionHUD } from './components/CameraVisionHUD';
import EtherealCavernBg from './assets/images/ethereal_cavern_moon_1788699104693.jpg';

import {
  ChatMessage,
  Emotion,
  CharacterAnimation,
  ColumbinaFacialExpression,
  ColumbinaAction,
  AssistantConfig,
  VRMModelMeta,
  VoiceCorrectionResult,
  ColumbinaLanguage,
  ParalinguisticAnalysis,
  ExecutionDiagnostic,
} from './types';

// Natural language switch detection helper
function detectLanguageSwitch(text: string): ColumbinaLanguage | null {
  const lower = (text || "").toLowerCase().trim();
  if (!lower) return null;

  // 1. Hindi detection patterns
  if (
    lower.includes("speak hindi") ||
    lower.includes("talk in hindi") ||
    lower.includes("switch to hindi") ||
    lower.includes("change to hindi") ||
    lower.includes("can you speak hindi") ||
    lower.includes("hindi please") ||
    lower.includes("hindi mein") ||
    lower.includes("hindi me") ||
    /हिंदी\s*में\s*बात\s*करो/i.test(text) ||
    /हिंदी\s*बोलो/i.test(text) ||
    /हिंदी/i.test(text)
  ) {
    return "Hindi";
  }

  // 2. Bengali detection patterns
  if (
    lower.includes("speak bengali") ||
    lower.includes("talk in bengali") ||
    lower.includes("switch to bengali") ||
    lower.includes("change to bengali") ||
    lower.includes("can you speak bengali") ||
    lower.includes("bengali please") ||
    lower.includes("bangla please") ||
    lower.includes("banglay kotha") ||
    lower.includes("bangla te") ||
    /বাংলায়\s*কথা\s*বলো/i.test(text) ||
    /বাংলা\s*বলো/i.test(text) ||
    /বাংলা/i.test(text)
  ) {
    return "Bengali";
  }

  // 3. Japanese detection patterns
  if (
    lower.includes("speak japanese") ||
    lower.includes("talk in japanese") ||
    lower.includes("switch to japanese") ||
    lower.includes("change to japanese") ||
    lower.includes("can you speak japanese") ||
    lower.includes("japanese please") ||
    lower.includes("nihongo de") ||
    /日本語で話して/i.test(text) ||
    /日本語を話して/i.test(text) ||
    /日本語/i.test(text)
  ) {
    return "Japanese";
  }

  // 4. English detection patterns
  if (
    lower.includes("speak english") ||
    lower.includes("talk in english") ||
    lower.includes("switch to english") ||
    lower.includes("change to english") ||
    lower.includes("english again") ||
    lower.includes("talk to me in english") ||
    lower.includes("can you speak english") ||
    lower.includes("english please") ||
    lower.includes("back to english")
  ) {
    return "English";
  }

  return null;
}

const DEFAULT_VRM_URL = '/columbinamodel.vrm';

const INITIAL_CONFIG: AssistantConfig = {
  aiBrain: 'auto',
  personality: 'ethereal',
  userName: 'Friend',
  voiceSpeed: 0.88,
  voicePitch: 1.10,
  autoSpeak: true,
  selectedVoiceURI: '',
  ttsEngine: 'fish',
  fishReferenceId: 'f2aed07c91614db28daaaa849150cc6e',
  modelUrl: DEFAULT_VRM_URL,
  lightingPreset: 'soft',
  backgroundPreset: 'gradient',
  cameraPreset: 'full',
  soundEffects: true,
  speechLanguage: 'en-US',
  currentLanguage: 'English',
};

export default function App() {
  const [config, setConfig] = useState<AssistantConfig>(INITIAL_CONFIG);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [userLastEmotion, setUserLastEmotion] = useState<string>('neutral');
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('calm');
  const [currentAnimation, setCurrentAnimation] = useState<CharacterAnimation>('idle');
  const [currentFacialExpression, setCurrentFacialExpression] = useState<ColumbinaFacialExpression | string | undefined>('neutral');
  const [currentAction, setCurrentAction] = useState<ColumbinaAction | string | undefined>('idle');
  const [emotionIntensity, setEmotionIntensity] = useState<number>(0.35);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [modelMeta, setModelMeta] = useState<VRMModelMeta | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [lastDiagnostic, setLastDiagnostic] = useState<ExecutionDiagnostic | null>(null);

  // Firebase Auth & Memory State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [awaitingGoogleConsent, setAwaitingGoogleConsent] = useState<boolean>(false);
  const [awaitingPreferredName, setAwaitingPreferredName] = useState<boolean>(false);

  // Timer to revert temporary emotions and animations back to neutral/idle
  const emotionResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load available TTS voices on mount
  useEffect(() => {
    audioService.getVoices().then((voices) => {
      setAvailableVoices(voices);
    });
  }, []);

  // Firebase Authentication State Listener & Memory Auto-sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setIsAuthenticated(true);
        const profile = await firebaseService.getUserProfile(firebaseUser.uid);
        setUserProfile(profile);
        await memoryService.setActiveUser(firebaseUser.uid);

        if (profile?.preferredName) {
          setConfig((prev) => ({ ...prev, userName: profile.preferredName }));
        }
        setAwaitingGoogleConsent(false);
      } else {
        setIsAuthenticated(false);
        setUserProfile(null);
        memoryService.clearActiveUser();
        setAwaitingGoogleConsent(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Initial greeting from Columbina Hyposelenia
  useEffect(() => {
    const currentAuthUser = auth.currentUser;
    let greetingText = "";

    if (currentAuthUser) {
      const preferred = userProfile?.preferredName || currentAuthUser.displayName;
      if (preferred) {
        greetingText = `Welcome back, ${preferred}. It is quiet and peaceful here... I am glad you returned.`;
      } else {
        greetingText = "Mm-hmm... Welcome back. It is quiet here today. What is on your mind?";
      }
    } else {
      greetingText =
        "Mm-hmm... The light is very gentle today. Hello. I am Columbina. Would you like to connect your Google account so I can remember our conversations across time?";
    }

    const initialMessage: ChatMessage = {
      id: 'greeting-columbina-' + Date.now(),
      role: 'assistant',
      content: greetingText,
      cleanText: greetingText,
      emotion: 'gentle',
      expression: '[calm]',
      voice_direction: '(whispering)',
      animation: 'idle',
      intensity: 0.35,
      timestamp: Date.now(),
    };

    setMessages([initialMessage]);

    // Speak greeting on first user interaction or delay
    const timer = setTimeout(() => {
      if (config.autoSpeak) {
        speakText(greetingText, 'gentle', '[calm]', '(whispering)');
      }
    }, 1400);

    return () => clearTimeout(timer);
  }, [userProfile?.preferredName]);


  // Trigger an emotion with auto-revert
  const triggerEmotion = useCallback((emotion: Emotion, durationMs: number = 4000) => {
    setCurrentEmotion(emotion);
    if (config.soundEffects) {
      audioService.playChime('emotion');
    }

    if (emotionResetTimeoutRef.current) {
      clearTimeout(emotionResetTimeoutRef.current);
    }

    if (emotion !== 'neutral' && emotion !== 'calm') {
      emotionResetTimeoutRef.current = setTimeout(() => {
        setCurrentEmotion('calm');
        setCurrentAnimation('idle');
      }, durationMs);
    }
  }, [config.soundEffects]);

  // Handle Speech synthesis and Viseme driving
  const speakText = useCallback(
    async (
      text: string,
      emotionForSpeech?: Emotion,
      expression?: string,
      voiceDirection?: string,
      languageForSpeech?: ColumbinaLanguage
    ) => {
      if (emotionForSpeech) {
        setCurrentEmotion(emotionForSpeech);
      }

      setIsSpeaking(true);

      const activeLang = languageForSpeech || config.currentLanguage || 'English';
      const speechLangCode =
        activeLang === 'Hindi'
          ? 'hi-IN'
          : activeLang === 'Bengali'
          ? 'bn-IN'
          : activeLang === 'Japanese'
          ? 'ja-JP'
          : config.speechLanguage || 'en-US';

      if (config.ttsEngine === 'fish') {
        try {
          const analyserNode = await audioService.speakFishAudio(text, {
            referenceId: config.fishReferenceId || 'f2aed07c91614db28daaaa849150cc6e',
            expression,
            voiceDirection,
            onStart: () => {
              setIsSpeaking(true);
            },
            onEnd: () => {
              setIsSpeaking(false);
              setTimeout(() => {
                setCurrentEmotion('gentle');
                setCurrentAnimation('idle');
              }, 1200);
            },
            onError: () => {
              // Graceful fallback to browser speech synthesis
              audioService.speak(text, {
                voiceURI: config.selectedVoiceURI,
                rate: config.voiceSpeed,
                pitch: config.voicePitch,
                lang: speechLangCode,
                onStart: () => setIsSpeaking(true),
                onEnd: () => {
                  setIsSpeaking(false);
                  setTimeout(() => {
                    setCurrentEmotion('gentle');
                    setCurrentAnimation('idle');
                  }, 1200);
                },
                onError: () => setIsSpeaking(false),
              });
            },
          });

          if (analyserNode) {
            setAnalyser(analyserNode);
            return;
          }
        } catch {
          // Handled by onError fallback
        }
      } else if (config.ttsEngine === 'gemini') {
        try {
          const analyserNode = await audioService.speakGeminiTTS(text, {
            voice: 'Aoede',
            onStart: () => {
              setIsSpeaking(true);
            },
            onEnd: () => {
              setIsSpeaking(false);
              setTimeout(() => {
                setCurrentEmotion('gentle');
                setCurrentAnimation('idle');
              }, 1200);
            },
            onError: () => {
              audioService.speak(text, {
                voiceURI: config.selectedVoiceURI,
                rate: config.voiceSpeed,
                pitch: config.voicePitch,
                lang: speechLangCode,
                onStart: () => setIsSpeaking(true),
                onEnd: () => {
                  setIsSpeaking(false);
                  setTimeout(() => {
                    setCurrentEmotion('gentle');
                    setCurrentAnimation('idle');
                  }, 1200);
                },
                onError: () => setIsSpeaking(false),
              });
            },
          });

          if (analyserNode) {
            setAnalyser(analyserNode);
            return;
          }
        } catch {
          // Handled by onError fallback
        }
      }

      // Default Web Speech synthesis
      audioService.speak(text, {
        voiceURI: config.selectedVoiceURI,
        rate: config.voiceSpeed,
        pitch: config.voicePitch,
        lang: speechLangCode,
        onStart: () => {
          setIsSpeaking(true);
        },
        onEnd: () => {
          setIsSpeaking(false);
          setTimeout(() => {
            setCurrentEmotion('gentle');
            setCurrentAnimation('idle');
          }, 1200);
        },
        onError: () => {
          setIsSpeaking(false);
        },
      });
    },
    [
      config.currentLanguage,
      config.fishReferenceId,
      config.selectedVoiceURI,
      config.speechLanguage,
      config.ttsEngine,
      config.voicePitch,
      config.voiceSpeed,
    ]
  );

  // Trigger Google Sign-In Flow
  const triggerGoogleLogin = useCallback(async () => {
    setIsLoggingIn(true);
    const result = await firebaseService.signInWithGoogle();
    setIsLoggingIn(false);

    if (result.user) {
      const profile = await firebaseService.getUserProfile(result.user.uid);
      setUserProfile(profile);
      await memoryService.setActiveUser(result.user.uid);

      if (profile?.preferredName) {
        setConfig((prev) => ({ ...prev, userName: profile.preferredName }));
        const welcomeText = `Welcome back, ${profile.preferredName}. It is quiet and peaceful here... I am glad you returned.`;
        const astMsg: ChatMessage = {
          id: 'ast-' + Date.now(),
          role: 'assistant',
          content: welcomeText,
          cleanText: welcomeText,
          emotion: 'happy',
          animation: 'talking',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, astMsg]);
        speakText(welcomeText, 'happy');
        setAwaitingGoogleConsent(false);
        setAwaitingPreferredName(false);
      } else {
        setAwaitingPreferredName(true);
        setAwaitingGoogleConsent(false);
        const namePromptText = "Welcome. Since we're connected now, what should I call you?";
        const astMsg: ChatMessage = {
          id: 'ast-' + Date.now(),
          role: 'assistant',
          content: namePromptText,
          cleanText: namePromptText,
          emotion: 'curious',
          animation: 'talking',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, astMsg]);
        speakText(namePromptText, 'curious');
      }
    } else {
      const isCancelled = result.isCancelled;
      const responseText = isCancelled
        ? "That's quite alright... We can continue our conversation without connecting an account."
        : (result.error || "That's quite alright—we can continue our conversation without connecting an account.");
      const astMsg: ChatMessage = {
        id: 'ast-' + Date.now(),
        role: 'assistant',
        content: responseText,
        cleanText: responseText,
        emotion: 'gentle',
        animation: 'idle',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, astMsg]);
      speakText(responseText, 'gentle');
      setAwaitingGoogleConsent(false);
    }
  }, [speakText]);


  // Trigger Logout
  const triggerLogout = useCallback(async () => {
    await firebaseService.logout();
    memoryService.clearActiveUser();
    setIsAuthenticated(false);
    setUserProfile(null);
    setConfig((prev) => ({ ...prev, userName: 'Friend' }));
    setAwaitingGoogleConsent(true);

    const logoutText = "Of course. I'll sign you out and keep our shared memories safe until you return.";
    const astMsg: ChatMessage = {
      id: 'ast-' + Date.now(),
      role: 'assistant',
      content: logoutText,
      cleanText: logoutText,
      emotion: 'gentle',
      animation: 'talking',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, astMsg]);
    speakText(logoutText, 'gentle');
  }, [speakText]);

  // Send message to AI Brain (Gemini / OpenAI)
  const handleSendMessage = async (text: string, voiceAnalysis?: ParalinguisticAnalysis) => {
    const trimmed = text.trim();
    if (!trimmed || isGenerating) return;

    // Speech Interruption: If Columbina is currently speaking, stop playback immediately
    if (isSpeaking) {
      handleStopSpeaking();
    }

    if (config.soundEffects) {
      audioService.playChime('send');
    }

    const lowerText = trimmed.toLowerCase();

    // 1. Check for Logout Intent
    const isLogoutCmd =
      lowerText.includes('log me out') ||
      lowerText.includes('logout') ||
      lowerText.includes('sign me out') ||
      lowerText.includes('sign out') ||
      lowerText.includes('disconnect my google') ||
      lowerText.includes('disconnect account');

    if (isLogoutCmd) {
      const usrMsg: ChatMessage = {
        id: 'usr-' + Date.now(),
        role: 'user',
        content: trimmed,
        cleanText: trimmed,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, usrMsg]);
      await triggerLogout();
      return;
    }

    // 2. Check for Google Connection Consent Response
    if (awaitingGoogleConsent || lowerText.includes('connect my google account') || lowerText.includes('connect google')) {
      const isPositive =
        /\b(yes|yeah|yep|sure|okay|ok|alright|connect|connect it|login|sign in|go ahead|let's do it|i agree|yes please|please connect)\b/i.test(lowerText);

      const isNegative =
        /\b(no|nope|not now|maybe later|don't connect|cancel|no thanks|i don't want to)\b/i.test(lowerText);

      if (isPositive) {
        const usrMsg: ChatMessage = {
          id: 'usr-' + Date.now(),
          role: 'user',
          content: trimmed,
          cleanText: trimmed,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, usrMsg]);

        const notifyText = "Opening Google Sign-In for you...";
        speakText(notifyText, 'gentle');
        await triggerGoogleLogin();
        return;
      } else if (isNegative && awaitingGoogleConsent) {
        const usrMsg: ChatMessage = {
          id: 'usr-' + Date.now(),
          role: 'user',
          content: trimmed,
          cleanText: trimmed,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, usrMsg]);

        setAwaitingGoogleConsent(false);
        const declineText = "Of course. We can keep talking without connecting an account.";
        const astMsg: ChatMessage = {
          id: 'ast-' + Date.now(),
          role: 'assistant',
          content: declineText,
          cleanText: declineText,
          emotion: 'gentle',
          animation: 'idle',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, astMsg]);
        speakText(declineText, 'gentle');
        return;
      }
    }

    // 3. Check for Preferred Name Response or Explicit Name Command
    const isExplicitNameCmd =
      lowerText.startsWith('call me ') ||
      lowerText.startsWith('my name is ') ||
      lowerText.startsWith('you can call me ');

    if ((awaitingPreferredName || isExplicitNameCmd) && auth.currentUser) {
      let extractedName = trimmed;
      if (lowerText.startsWith('call me ')) {
        extractedName = trimmed.slice(8).trim();
      } else if (lowerText.startsWith('my name is ')) {
        extractedName = trimmed.slice(11).trim();
      } else if (lowerText.startsWith('you can call me ')) {
        extractedName = trimmed.slice(16).trim();
      }

      extractedName = extractedName.replace(/[.!?]$/, '').trim();

      if (extractedName) {
        const usrMsg: ChatMessage = {
          id: 'usr-' + Date.now(),
          role: 'user',
          content: trimmed,
          cleanText: trimmed,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, usrMsg]);

        await firebaseService.savePreferredName(auth.currentUser.uid, extractedName);
        setConfig((prev) => ({ ...prev, userName: extractedName }));
        if (userProfile) {
          setUserProfile({ ...userProfile, preferredName: extractedName });
        }
        setAwaitingPreferredName(false);

        const nameAckText = `${extractedName}. I'll remember that.`;
        const astMsg: ChatMessage = {
          id: 'ast-' + Date.now(),
          role: 'assistant',
          content: nameAckText,
          cleanText: nameAckText,
          emotion: 'happy',
          animation: 'talking',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, astMsg]);
        speakText(nameAckText, 'happy');
        return;
      }
    }


    // Check for camera commands first
    const cameraCmd = cameraVisionService.parseCameraCommand(trimmed);
    let cameraResponse = '';
    let captureForAI = false;

    if (cameraCmd.isCommand && cameraCmd.type) {
      if (cameraCmd.type === 'turn_on' || cameraCmd.type === 'front_camera' || cameraCmd.type === 'back_camera') {
        const result = await cameraVisionService.startCamera(cameraCmd.facingMode);
        cameraResponse = result.message;
        captureForAI = true; 
      } else if (cameraCmd.type === 'turn_off') {
        cameraResponse = cameraVisionService.stopCamera();
      } else if (cameraCmd.type === 'switch_camera') {
        const result = await cameraVisionService.switchCamera();
        cameraResponse = result.message;
        captureForAI = true;
      }
    }

    let base64Image: string | null = null;
    // Wait briefly if we just activated the camera so the stream has a frame
    if (captureForAI) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (cameraVisionService.isCameraActive()) {
      base64Image = cameraVisionService.captureFrameBase64();
    }

    // Auto-detect natural language switch requested by the user
    const detectedSwitch = detectLanguageSwitch(trimmed);
    let activeLang: ColumbinaLanguage = detectedSwitch || config.currentLanguage || 'English';

    if (detectedSwitch && detectedSwitch !== config.currentLanguage) {
      const speechMap: Record<ColumbinaLanguage, string> = {
        English: 'en-US',
        Hindi: 'hi-IN',
        Bengali: 'bn-IN',
        Japanese: 'ja-JP',
      };
      setConfig((prev) => ({
        ...prev,
        currentLanguage: detectedSwitch,
        speechLanguage: speechMap[detectedSwitch] || 'en-US',
      }));
    }

    // Auto-detect user facts or preferences to enrich memory
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('i love ') || lower.startsWith('i like ') || lower.startsWith('my favorite ')) {
      memoryService.addPreference(trimmed);
    } else if (lower.startsWith('my name is ') || lower.startsWith('i am a ') || lower.startsWith('i live in ')) {
      memoryService.addFact(trimmed);
    }

    const userMessage: ChatMessage = {
      id: 'usr-' + Date.now(),
      role: 'user',
      content: trimmed,
      cleanText: trimmed,
      timestamp: Date.now(),
      voiceAnalysis,
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setIsGenerating(true);

    // Avatar reflects thoughtfully while generating
    setCurrentEmotion('thinking');
    setCurrentAnimation('thinking');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map((m, idx) => {
            const isLast = idx === newHistory.length - 1;
            return {
              role: m.role,
              content: m.cleanText || m.content,
              voiceAnalysis: m.voiceAnalysis,
              image: isLast && m.role === 'user' ? base64Image : undefined,
              isCameraActive: isLast && m.role === 'user' ? cameraVisionService.isCameraActive() : undefined,
            };
          }),
          voiceAnalysis,
          aiBrain: config.aiBrain || 'gemini',
          personality: config.personality,
          memory: memoryService.getMemory(),
          currentLanguage: activeLang,
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      const responseEmotion = (data.emotion as Emotion) || 'gentle';
      const responseAnimation = (data.animation as CharacterAnimation) || 'talking';
      const responseIntensity = typeof data.intensity === 'number' ? data.intensity : 0.35;
      const responseExpression = data.expression || '';
      const responseVoiceDirection = data.voice_direction || '';
      const spokenMessage = (data.message || data.cleanText || data.text || '').trim();

      if (data.diagnostic) {
        setLastDiagnostic(data.diagnostic);
      }

      // Ensure language state syncs from backend response
      if (data.currentLanguage && ['English', 'Hindi', 'Bengali', 'Japanese'].includes(data.currentLanguage)) {
        const returnedLang = data.currentLanguage as ColumbinaLanguage;
        if (returnedLang !== config.currentLanguage) {
          const speechMap: Record<ColumbinaLanguage, string> = {
            English: 'en-US',
            Hindi: 'hi-IN',
            Bengali: 'bn-IN',
            Japanese: 'ja-JP',
          };
          setConfig((prev) => ({
            ...prev,
            currentLanguage: returnedLang,
            speechLanguage: speechMap[returnedLang] || 'en-US',
          }));
          activeLang = returnedLang;
        }
      }

      const assistantMessage: ChatMessage = {
        id: 'ast-' + Date.now(),
        role: 'assistant',
        content: spokenMessage,
        cleanText: spokenMessage,
        emotion: responseEmotion,
        expression: responseExpression,
        voice_direction: responseVoiceDirection,
        animation: responseAnimation,
        intensity: responseIntensity,
        timestamp: Date.now(),
        language: activeLang,
        brain: data.brain || data.diagnostic?.selectedProvider,
        diagnostic: data.diagnostic,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // 1. Emotion -> VRM Expression System
      setCurrentEmotion(responseEmotion);
      setEmotionIntensity(responseIntensity);
      if (data.facialExpression) {
        setCurrentFacialExpression(data.facialExpression);
      }

      // 2. Animation & Action -> VRM Animation System
      setCurrentAnimation(responseAnimation);
      if (data.action || data.gesture) {
        setCurrentAction(data.action || data.gesture);
      }

      if (config.soundEffects) {
        audioService.playChime('receive');
      }

      // 3. Spoken text -> Voice / TTS System (Columbina speaks her response)
      if (spokenMessage) {
        speakText(spokenMessage, responseEmotion, responseExpression, responseVoiceDirection, activeLang);
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
      const fallbackMessages: Record<ColumbinaLanguage, string> = {
        English: "The stars fell silent for a fleeting breath... I am still here beside you, listening softly.",
        Hindi: "हवा में एक शांत झोंका बह गया... I am still here beside you, listening softly.",
        Bengali: "হাওয়ায় একটা শান্ত দোলা দিয়ে গেল... I am still here beside you, listening softly.",
        Japanese: "風が静かに通り過ぎていきましたね... I am still here beside you, listening softly.",
      };
      const fallbackText = fallbackMessages[activeLang] || fallbackMessages.English;
      const errorMessage: ChatMessage = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: fallbackText,
        cleanText: fallbackText,
        emotion: 'gentle',
        expression: '[calm]',
        voice_direction: '',
        animation: 'idle',
        intensity: 0.3,
        timestamp: Date.now(),
        language: activeLang,
      };
      setMessages((prev) => [...prev, errorMessage]);
      setCurrentEmotion('gentle');
      setCurrentAnimation('idle');
      speakText(fallbackText, 'gentle', '[calm]', '(softly)', activeLang);
    } finally {
      setIsGenerating(false);
    }
  };

  // Voice utterance handler through Voice Auto-Correction & Disambiguation pipeline
  const handleVoiceUtterance = async (
    rawTranscript: string,
    language?: string,
    voiceAnalysis?: ParalinguisticAnalysis
  ) => {
    const trimmed = rawTranscript.trim();
    if (!trimmed || isGenerating) return;

    // Speech Interruption: If Columbina is speaking, interrupt immediately
    if (isSpeaking) {
      handleStopSpeaking();
    }

    try {
      // 1. Pass through AI Voice Auto-Correction & Context Disambiguation
      const correctRes = await fetch('/api/voice/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawTranscript: trimmed,
          recentMessages: messages.map((m) => ({
            role: m.role,
            content: m.cleanText || m.content,
          })),
          language: language || config.speechLanguage || 'en-US',
        }),
      });

      if (!correctRes.ok) {
        throw new Error(`Voice correction HTTP ${correctRes.status}`);
      }

      const data: VoiceCorrectionResult = await correctRes.json();

      // Ignore pure acoustic noise / filler without generating an AI response (Requirement 10)
      if (data.isNoise || !data.correctedText) {
        return;
      }

      // If confidence is low, trigger Columbina's natural clarification spoken aloud (Requirement 6 & 7)
      if (data.needsClarification || data.confidence < 0.50) {
        const clarifyText =
          data.clarificationText ||
          "Mm... I couldn't quite hear you. Could you say that again?";
        const assistantMessage: ChatMessage = {
          id: 'ast-' + Date.now(),
          role: 'assistant',
          content: clarifyText,
          cleanText: clarifyText,
          emotion: 'gentle',
          expression: '[calm]',
          voice_direction: '(whispering)',
          animation: 'talking',
          intensity: 0.35,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setCurrentEmotion('gentle');
        setCurrentAnimation('talking');
        speakText(clarifyText, 'gentle', '[calm]', '(whispering)');
        return;
      }

      // High/medium confidence: send cleaned & corrected user message to Columbina Brain
      await handleSendMessage(data.correctedText, voiceAnalysis);
    } catch (err) {
      console.warn('Voice auto-correction fallback, sending raw transcript:', err);
      await handleSendMessage(trimmed, voiceAnalysis);
    }
  };

  // Replay audio for a past message
  const handleReplayAudio = (message: ChatMessage) => {
    const textToSpeak = message.cleanText || message.content;
    speakText(textToSpeak, message.emotion, message.expression, message.voice_direction);
  };

  // Stop current speech playback (for user interruption)
  const handleStopSpeaking = useCallback(() => {
    audioService.stop();
    setIsSpeaking(false);
  }, []);

  // Avatar Poke Interaction
  const handleAvatarClick = () => {
    if (config.soundEffects) {
      audioService.playChime('emotion');
    }
    triggerEmotion('curious', 2800);

    const activeLang = config.currentLanguage || 'English';
    const pokeLinesByLang: Record<ColumbinaLanguage, string[]> = {
      English: [
        "Mm-hmm... The moonlight feels quiet today. Did you want to speak with me?",
        "Oh... You reached out to me. Are humans usually this fond of touching things they find unfamiliar?",
        "Mm... I was watching the soft dust drifting in the air. What is on your mind?",
        "I was just humming a quiet melody from Silvermoon Hall... What brings you over?",
        "I don't mind you being close. It feels... peaceful.",
      ],
      Hindi: [
        "Mm-hmm... आज रात का moonlight कितना शांत है. Did you want to speak with me?",
        "Oh... तुमने मुझे छू लिया. Are humans always this curious about unfamiliar things?",
        "Mm... मैं हवा में तैरती हुई quiet dust को देख रही थी. What is on your mind?",
        "मैं Silvermoon Hall की एक quiet melody hum कर रही थी... What brings you over?",
        "तुम्हारे पास होने से मुझे अच्छा लगता है... it feels very peaceful.",
      ],
      Bengali: [
        "Mm-hmm... আজকের moonlight সত্যি খুব শান্ত. Did you want to speak with me?",
        "Oh... তুমি আমাকে ছুঁয়ে দিলে? Humans are so curious, aren't they?",
        "Mm... আমি হাওয়ায় ভেসে থাকা quiet dust দেখছিলাম. What is on your mind?",
        "আমি Silvermoon Hall এর একটা quiet melody hum করছিলাম... What brings you over?",
        "তুমি পাশে থাকলে খুব ভালো লাগে... it feels very peaceful.",
      ],
      Japanese: [
        "Mm-hmm... 今夜の moonlight はとても静かですね. Did you want to speak with me?",
        "Oh... 触れてくれたのですね. Humans are so curious, aren't they?",
        "Mm... 空気中を漂う quiet dust を眺めていました. What is on your mind?",
        "Silvermoon Hall の静かな melody を hum していたところです... What brings you over?",
        "近くにいてくれると... it feels very peaceful.",
      ],
    };

    const langLines = pokeLinesByLang[activeLang] || pokeLinesByLang.English;
    const randomLine = langLines[Math.floor(Math.random() * langLines.length)];

    if (!isSpeaking && !isGenerating) {
      speakText(randomLine, 'calm', undefined, undefined, activeLang);
    }
  };

  // Custom model file upload
  const handleCustomModelUpload = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setConfig((prev) => ({ ...prev, modelUrl: objectUrl }));
  };

  const handleResetModel = () => {
    setConfig((prev) => ({ ...prev, modelUrl: DEFAULT_VRM_URL }));
  };

  const handleUpdateConfig = (partial: Partial<AssistantConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastSpokenText = lastAssistantMessage?.cleanText || lastAssistantMessage?.content || '';

  return (
    <main
      onClick={handleAvatarClick}
      className="relative w-screen h-screen overflow-hidden bg-neutral-950 font-sans select-none cursor-pointer bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${EtherealCavernBg})` }}
      title="Click anywhere to interact with Columbina"
    >
      {/* 3D VRM Canvas Viewport */}
      <VRMViewer
        modelUrl={config.modelUrl}
        currentEmotion={currentEmotion}
        currentAnimation={currentAnimation}
        facialExpression={currentFacialExpression}
        action={currentAction}
        emotionIntensity={emotionIntensity}
        isSpeaking={isSpeaking}
        isListening={isListening}
        spokenText={lastSpokenText}
        userEmotion={userLastEmotion}
        analyser={analyser}
        lightingPreset={config.lightingPreset}
        cameraPreset={config.cameraPreset}
        backgroundPreset={config.backgroundPreset}
        onModelLoaded={(meta) => setModelMeta(meta)}
        onAvatarClick={handleAvatarClick}
      />

      {/* Camera Vision HUD */}
      <CameraVisionHUD isAiAnalyzing={isGenerating} onNotify={(msg) => console.log('Camera System:', msg)} />

      {/* Account Authentication & Isolated Memory Header */}
      <AuthStatusHeader
        user={userProfile}
        isAuthenticated={isAuthenticated}
        isLoggingIn={isLoggingIn}
        onLogin={triggerGoogleLogin}
        onLogout={triggerLogout}
      />

      {/* Ethereal Floating Input Bar */}

      <EtherealDialogueBar
        isGenerating={isGenerating}
        isSpeaking={isSpeaking}
        currentEmotion={currentEmotion}
        lastSpokenText={lastSpokenText}
        speechLanguage={config.speechLanguage}
        currentLanguage={config.currentLanguage || 'English'}
        onSendMessage={handleSendMessage}
        onSendVoiceUtterance={handleVoiceUtterance}
        onStopSpeaking={handleStopSpeaking}
        onListeningChange={(listening) => setIsListening(listening)}
        onLanguageChange={(lang) =>
          setConfig((prev) => ({ ...prev, speechLanguage: lang }))
        }
        onColumbinaLanguageChange={(lang) => {
          const speechMap: Record<ColumbinaLanguage, string> = {
            English: 'en-US',
            Hindi: 'hi-IN',
            Bengali: 'bn-IN',
            Japanese: 'ja-JP',
          };
          setConfig((prev) => ({
            ...prev,
            currentLanguage: lang,
            speechLanguage: speechMap[lang] || 'en-US',
          }));
        }}
      />
    </main>
  );
}
