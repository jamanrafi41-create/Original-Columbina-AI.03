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
import { androidPwaService } from './services/androidPwaService';
import { AndroidInstallButton } from './components/AndroidInstallButton';
import { AndroidInstallGuideModal } from './components/AndroidInstallGuideModal';
import { voiceCorrectionService } from './services/voiceCorrectionService';
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
  const [isAndroidGuideOpen, setIsAndroidGuideOpen] = useState<boolean>(false);

  // Timer to revert temporary emotions and animations back to neutral/idle
  const emotionResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // High-performance streaming speech queue & interruption controller
  const speechQueueRef = useRef<Array<{
    text: string;
    emotion?: Emotion;
    expression?: string;
    voiceDirection?: string;
    language?: ColumbinaLanguage;
  }>>([]);
  const isAudioPlayingRef = useRef<boolean>(false);
  const streamCompleteRef = useRef<boolean>(true);
  const chatAbortControllerRef = useRef<AbortController | null>(null);

  // Stop current speech playback and streaming (for user interruption)
  const handleStopSpeaking = useCallback(() => {
    if (chatAbortControllerRef.current) {
      chatAbortControllerRef.current.abort();
      chatAbortControllerRef.current = null;
    }
    speechQueueRef.current = [];
    isAudioPlayingRef.current = false;
    streamCompleteRef.current = true;
    audioService.stop();
    setIsSpeaking(false);
    setIsGenerating(false);
  }, []);

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

  // Play a single sentence through the configured TTS engine with fallback and viseme driving
  const playSentenceItem = useCallback(
    async (
      item: {
        text: string;
        emotion?: Emotion;
        expression?: string;
        voiceDirection?: string;
        language?: ColumbinaLanguage;
      },
      onFinished: () => void
    ) => {
      const trimmedText = item.text.trim();
      if (!trimmedText) {
        onFinished();
        return;
      }

      if (item.emotion) {
        setCurrentEmotion(item.emotion);
      }

      const activeLang = item.language || config.currentLanguage || 'English';
      const speechLangCode =
        activeLang === 'Hindi'
          ? 'hi-IN'
          : activeLang === 'Bengali'
          ? 'bn-IN'
          : activeLang === 'Japanese'
          ? 'ja-JP'
          : config.speechLanguage || 'en-US';

      let finished = false;
      const safeFinish = () => {
        if (!finished) {
          finished = true;
          onFinished();
        }
      };

      if (config.ttsEngine === 'fish') {
        try {
          const analyserNode = await audioService.speakFishAudio(trimmedText, {
            referenceId: config.fishReferenceId || 'f2aed07c91614db28daaaa849150cc6e',
            expression: item.expression,
            voiceDirection: item.voiceDirection,
            onStart: () => setIsSpeaking(true),
            onEnd: safeFinish,
            onError: () => {
              // Fast graceful fallback to browser speech synthesis
              audioService.speak(trimmedText, {
                voiceURI: config.selectedVoiceURI,
                rate: config.voiceSpeed,
                pitch: config.voicePitch,
                lang: speechLangCode,
                onStart: () => setIsSpeaking(true),
                onEnd: safeFinish,
                onError: safeFinish,
              });
            },
          });

          if (analyserNode) {
            setAnalyser(analyserNode);
            return;
          }
        } catch {
          // Handled by safeFinish fallback
        }
      } else if (config.ttsEngine === 'gemini') {
        try {
          const analyserNode = await audioService.speakGeminiTTS(trimmedText, {
            voice: 'Aoede',
            onStart: () => setIsSpeaking(true),
            onEnd: safeFinish,
            onError: () => {
              audioService.speak(trimmedText, {
                voiceURI: config.selectedVoiceURI,
                rate: config.voiceSpeed,
                pitch: config.voicePitch,
                lang: speechLangCode,
                onStart: () => setIsSpeaking(true),
                onEnd: safeFinish,
                onError: safeFinish,
              });
            },
          });

          if (analyserNode) {
            setAnalyser(analyserNode);
            return;
          }
        } catch {
          // Handled by safeFinish
        }
      }

      // Default Web Speech synthesis
      audioService.speak(trimmedText, {
        voiceURI: config.selectedVoiceURI,
        rate: config.voiceSpeed,
        pitch: config.voicePitch,
        lang: speechLangCode,
        onStart: () => setIsSpeaking(true),
        onEnd: safeFinish,
        onError: safeFinish,
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

  // Process the next sentence in the speech queue
  const processNextInQueue = useCallback(() => {
    if (speechQueueRef.current.length > 0) {
      isAudioPlayingRef.current = true;
      setIsSpeaking(true);
      const next = speechQueueRef.current.shift()!;
      playSentenceItem(next, () => {
        processNextInQueue();
      });
    } else {
      isAudioPlayingRef.current = false;
      if (streamCompleteRef.current) {
        setIsSpeaking(false);
        setTimeout(() => {
          setCurrentEmotion('gentle');
          setCurrentAnimation('idle');
        }, 1200);
      }
    }
  }, [playSentenceItem]);

  // Enqueue a sentence to be spoken as soon as it arrives
  const enqueueSentence = useCallback(
    (item: {
      text: string;
      emotion?: Emotion;
      expression?: string;
      voiceDirection?: string;
      language?: ColumbinaLanguage;
    }) => {
      // Strip brackets, actions, parentheticals before speech
      const clean = item.text
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/\*[^*]+\*/g, '')
        .trim();

      if (!clean || clean.replace(/[^\p{L}\p{N}]/gu, '').length === 0) {
        return;
      }

      speechQueueRef.current.push({ ...item, text: clean });
      if (!isAudioPlayingRef.current) {
        processNextInQueue();
      }
    },
    [processNextInQueue]
  );

  // Handle Speech synthesis and Viseme driving for complete statements
  const speakText = useCallback(
    (
      text: string,
      emotionForSpeech?: Emotion,
      expression?: string,
      voiceDirection?: string,
      languageForSpeech?: ColumbinaLanguage
    ) => {
      handleStopSpeaking();
      streamCompleteRef.current = true;
      enqueueSentence({
        text,
        emotion: emotionForSpeech,
        expression,
        voiceDirection,
        language: languageForSpeech,
      });
    },
    [handleStopSpeaking, enqueueSentence]
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
  const handleSendMessage = async (
    text: string,
    voiceAnalysis?: ParalinguisticAnalysis,
    image?: string,
    imageName?: string
  ) => {
    const trimmed = text.trim();
    if ((!trimmed && !image) || isGenerating) return;

    // Speech Interruption: If Columbina is currently speaking, stop playback immediately
    if (isSpeaking) {
      handleStopSpeaking();
    }

    if (config.soundEffects) {
      audioService.playChime('send');
    }

    const effectiveText =
      trimmed ||
      (image
        ? "Here is a photo I am sharing with you. What do you see and what are your thoughts on it?"
        : '');

    const lowerText = effectiveText.toLowerCase();

    // 0. Check for Android Installation Intent ("Install this in my phone", "Install Columbina in my phone", etc.)
    if (androidPwaService.isInstallCommand(effectiveText)) {
      const usrMsg: ChatMessage = {
        id: 'usr-' + Date.now(),
        role: 'user',
        content: effectiveText,
        cleanText: effectiveText,
        timestamp: Date.now(),
        image,
        imageName,
      };
      setMessages((prev) => [...prev, usrMsg]);

      // Standalone check: Already installed and running
      if (androidPwaService.isStandalone()) {
        const standaloneReply =
          "Columbina is already installed and running as a standalone fullscreen app on your Android home screen, connected live to this website.";
        const astMsg: ChatMessage = {
          id: 'ast-' + Date.now(),
          role: 'assistant',
          content: standaloneReply,
          cleanText: standaloneReply,
          emotion: 'happy',
          animation: 'talking',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, astMsg]);
        speakText(standaloneReply, 'happy');
        return;
      }

      // Android Only check
      if (!androidPwaService.isAndroid()) {
        const desktopReply =
          "To install this website as an app on your phone's home screen, open this live website on your Android phone's Chrome browser and tap 'Install Columbina'. On desktop, we can continue speaking right here in your browser.";
        const astMsg: ChatMessage = {
          id: 'ast-' + Date.now(),
          role: 'assistant',
          content: desktopReply,
          cleanText: desktopReply,
          emotion: 'gentle',
          animation: 'talking',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, astMsg]);
        speakText(desktopReply, 'gentle');
        return;
      }

      // Android with installation prompt available: Trigger native browser prompt immediately!
      if (androidPwaService.isPromptAvailable()) {
        const promptNotice =
          "Opening the Android installation prompt now. Please tap Install on your screen to add Columbina to your home screen.";
        const astMsg: ChatMessage = {
          id: 'ast-' + Date.now(),
          role: 'assistant',
          content: promptNotice,
          cleanText: promptNotice,
          emotion: 'curious',
          animation: 'talking',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, astMsg]);
        speakText(promptNotice, 'curious');

        const result = await androidPwaService.triggerInstallPrompt();
        if (result.outcome === 'accepted') {
          const followUp =
            "Columbina has been added to your Android home screen! When you open Columbina, it will launch in full-screen view as an app with no browser URL bar, connected live to this website.";
          const followUpMsg: ChatMessage = {
            id: 'ast-' + Date.now(),
            role: 'assistant',
            content: followUp,
            cleanText: followUp,
            emotion: 'happy',
            animation: 'talking',
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, followUpMsg]);
          speakText(followUp, 'happy');
        } else if (result.outcome === 'dismissed') {
          const dismissMsg =
            "The installation prompt was dismissed. You can tap the Install Columbina button on your screen anytime to add it to your home screen.";
          const followUpMsg: ChatMessage = {
            id: 'ast-' + Date.now(),
            role: 'assistant',
            content: dismissMsg,
            cleanText: dismissMsg,
            emotion: 'gentle',
            animation: 'idle',
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, followUpMsg]);
        } else {
          setIsAndroidGuideOpen(true);
          const guideReply =
            "To install Columbina as a fullscreen app on your Android home screen, tap the 'Install Columbina' button on your screen, or tap your browser's menu (⋮) and select 'Install app' or 'Add to Home screen'.";
          const followUpMsg: ChatMessage = {
            id: 'ast-' + Date.now(),
            role: 'assistant',
            content: guideReply,
            cleanText: guideReply,
            emotion: 'gentle',
            animation: 'talking',
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, followUpMsg]);
          speakText(guideReply, 'gentle');
        }
        return;
      }

      // Android fallback: prompt not yet fired or requires Chrome menu
      setIsAndroidGuideOpen(true);
      const guideReply =
        "To install Columbina as a standalone fullscreen app on your phone, tap your browser's menu (the three dots ⋮ at the top right) and select 'Install app' or 'Add to Home screen'.";
      const astMsg: ChatMessage = {
        id: 'ast-' + Date.now(),
        role: 'assistant',
        content: guideReply,
        cleanText: guideReply,
        emotion: 'curious',
        animation: 'talking',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, astMsg]);
      speakText(guideReply, 'curious');
      return;
    }

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
    const lower = effectiveText.toLowerCase();
    if (lower.startsWith('i love ') || lower.startsWith('i like ') || lower.startsWith('my favorite ')) {
      memoryService.addPreference(effectiveText);
    } else if (lower.startsWith('my name is ') || lower.startsWith('i am a ') || lower.startsWith('i live in ')) {
      memoryService.addFact(effectiveText);
    }

    const userMessage: ChatMessage = {
      id: 'usr-' + Date.now(),
      role: 'user',
      content: effectiveText,
      cleanText: effectiveText,
      timestamp: Date.now(),
      voiceAnalysis,
      image,
      imageName,
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setIsGenerating(true);

    // Immediate visual responsiveness without blocking speech
    setCurrentEmotion('thinking');
    setCurrentAnimation('thinking');

    // Create assistant message placeholder for instant typewriter streaming
    const assistantMsgId = 'ast-' + Date.now();
    const assistantPlaceholder: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      cleanText: '',
      emotion: 'gentle',
      animation: 'talking',
      timestamp: Date.now(),
      language: activeLang,
    };
    setMessages((prev) => [...prev, assistantPlaceholder]);

    // Setup streaming & cancellation
    const abortController = new AbortController();
    chatAbortControllerRef.current = abortController;
    speechQueueRef.current = [];
    isAudioPlayingRef.current = false;
    streamCompleteRef.current = false;

    let accumulatedAssistantText = '';
    let finalDiagnostic: any = null;
    let finalEmotion: Emotion = 'gentle';
    let finalAnimation: CharacterAnimation = 'talking';
    let finalExpression = '';
    let finalVoiceDirection = '';

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          messages: newHistory.map((m, idx) => {
            const isLast = idx === newHistory.length - 1;
            return {
              role: m.role,
              content: m.cleanText || m.content,
              voiceAnalysis: m.voiceAnalysis,
              image: m.image || (isLast && m.role === 'user' ? (base64Image || undefined) : undefined),
              imageName: m.imageName,
              isCameraActive: isLast && m.role === 'user' ? cameraVisionService.isCameraActive() : undefined,
            };
          }),
          voiceAnalysis,
          aiBrain: config.aiBrain || 'gemini',
          personality: config.personality,
          memory: memoryService.getMemory(),
          currentLanguage: activeLang,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const parts = sseBuffer.split('\n\n');
          sseBuffer = parts.pop() || '';

          for (const part of parts) {
            const trimmedPart = part.trim();
            if (!trimmedPart.startsWith('data:')) continue;
            const dataStr = trimmedPart.slice(5).trim();
            if (!dataStr) continue;

            try {
              const event = JSON.parse(dataStr);

              if (event.type === 'meta') {
                if (event.emotion) {
                  finalEmotion = event.emotion as Emotion;
                  setCurrentEmotion(finalEmotion);
                }
                if (event.animation) {
                  finalAnimation = event.animation as CharacterAnimation;
                  setCurrentAnimation(finalAnimation);
                }
                if (event.intensity && typeof event.intensity === 'number') {
                  setEmotionIntensity(event.intensity);
                }
                if (event.facialExpression) {
                  setCurrentFacialExpression(event.facialExpression);
                }
                if (event.expression) {
                  finalExpression = event.expression;
                }
                if (event.voice_direction) {
                  finalVoiceDirection = event.voice_direction;
                }
                if (event.action || event.gesture) {
                  setCurrentAction(event.action || event.gesture);
                }
              } else if (event.type === 'chunk') {
                accumulatedAssistantText += event.chunk;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          content: accumulatedAssistantText,
                          cleanText: accumulatedAssistantText,
                        }
                      : m
                  )
                );
              } else if (event.type === 'sentence') {
                // START TTS IMMEDIATELY ON FIRST SENTENCE!
                enqueueSentence({
                  text: event.sentence,
                  emotion: finalEmotion,
                  expression: finalExpression,
                  voiceDirection: finalVoiceDirection,
                  language: activeLang,
                });
              } else if (event.type === 'done') {
                finalDiagnostic = event.diagnostic;
                if (event.emotion) finalEmotion = event.emotion as Emotion;
                if (event.animation) finalAnimation = event.animation as CharacterAnimation;
                if (event.expression) finalExpression = event.expression;
                if (event.voice_direction) finalVoiceDirection = event.voice_direction;
                const doneText = (event.message || event.cleanText || accumulatedAssistantText).trim();
                accumulatedAssistantText = doneText || accumulatedAssistantText;

                // Ensure language state syncs from backend response
                if (event.currentLanguage && ['English', 'Hindi', 'Bengali', 'Japanese'].includes(event.currentLanguage)) {
                  const returnedLang = event.currentLanguage as ColumbinaLanguage;
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

                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          content: accumulatedAssistantText,
                          cleanText: accumulatedAssistantText,
                          emotion: finalEmotion,
                          animation: finalAnimation,
                          expression: finalExpression,
                          voice_direction: finalVoiceDirection,
                          diagnostic: finalDiagnostic,
                          brain: event.brain || finalDiagnostic?.selectedProvider,
                        }
                      : m
                  )
                );

                if (finalDiagnostic) {
                  setLastDiagnostic(finalDiagnostic);
                }

                if (config.soundEffects) {
                  audioService.playChime('receive');
                }
              }
            } catch (parseErr) {
              // Ignore single malformed SSE chunk
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User interrupted or started speaking, clean exit
        return;
      }
      console.error('Streaming chat failed, falling back:', err);
      const fallbackMessages: Record<ColumbinaLanguage, string> = {
        English: "The stars fell silent for a fleeting breath... I am still here beside you, listening softly.",
        Hindi: "हवा में एक शांत झोंका बह गया... I am still here beside you, listening softly.",
        Bengali: "হাওয়ায় একটা শান্ত দোলা দিয়ে গেল... I am still here beside you, listening softly.",
        Japanese: "風が静かに通り過ぎていきましたね... I am still here beside you, listening softly.",
      };
      const fallbackText = fallbackMessages[activeLang] || fallbackMessages.English;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: fallbackText,
                cleanText: fallbackText,
                emotion: 'gentle',
                expression: '[calm]',
                animation: 'idle',
              }
            : m
        )
      );
      setCurrentEmotion('gentle');
      setCurrentAnimation('idle');
      speakText(fallbackText, 'gentle', '[calm]', '(softly)', activeLang);
    } finally {
      streamCompleteRef.current = true;
      setIsGenerating(false);
      chatAbortControllerRef.current = null;
      if (speechQueueRef.current.length === 0 && !isAudioPlayingRef.current) {
        setIsSpeaking(false);
      }
    }
  };

  // Voice utterance handler with deduplication, phonetic fixing, and auto-submission
  const handleVoiceUtterance = async (
    rawTranscript: string,
    language?: string,
    voiceAnalysis?: ParalinguisticAnalysis
  ) => {
    const trimmed = rawTranscript.trim();
    if (!trimmed || isGenerating) return;

    // Speech Interruption: If Columbina is speaking or thinking, interrupt immediately
    handleStopSpeaking();

    // Use intelligent speech correction (deduplication, phonetic fixing, Gemini enhancement)
    const activeLang = language || config.speechLanguage || 'en-US';
    const correctionResult = await voiceCorrectionService.correctTranscript(
      trimmed,
      activeLang,
      messages
    );

    // Reject noise or empty transcripts
    if (correctionResult.isNoise || !correctionResult.correctedText.trim()) {
      return;
    }

    // If clarification was requested by the correction engine
    if (correctionResult.needsClarification && correctionResult.clarificationText) {
      speakText(correctionResult.clarificationText, 'gentle', '[soft]', '(gently)', config.currentLanguage);
      return;
    }

    // Automatically send the complete recognized and corrected sentence to Columbina Brain
    await handleSendMessage(correctionResult.correctedText, voiceAnalysis);
  };

  // Replay audio for a past message
  const handleReplayAudio = (message: ChatMessage) => {
    const textToSpeak = message.cleanText || message.content;
    speakText(textToSpeak, message.emotion, message.expression, message.voice_direction);
  };

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

      {/* Android-Only PWA Standalone Install Button */}
      <AndroidInstallButton
        onInstalled={(msg) => {
          const astMsg: ChatMessage = {
            id: 'ast-' + Date.now(),
            role: 'assistant',
            content: msg,
            cleanText: msg,
            emotion: 'happy',
            animation: 'talking',
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, astMsg]);
          speakText(msg, 'happy');
        }}
        onShowGuide={() => setIsAndroidGuideOpen(true)}
      />

      {/* Android Installation Guide Modal */}
      <AndroidInstallGuideModal
        isOpen={isAndroidGuideOpen}
        onClose={() => setIsAndroidGuideOpen(false)}
      />
    </main>
  );
}
