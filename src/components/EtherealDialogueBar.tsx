import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Mic,
  EyeOff,
  Moon,
  Loader2,
  Volume2,
  AlertCircle,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { Emotion, ColumbinaLanguage, ParalinguisticAnalysis } from '../types';
import { voiceAnalysisService } from '../services/voiceAnalysisService';
import { audioService } from '../services/audioService';
import {
  mergeSpeechTranscripts,
  cleanFinalTranscript,
  getSilenceTimeoutForUtterance,
  isNoiseTranscript,
  normalizeForComparison,
} from '../utils/speechDeduplicator';

export const AVAILABLE_SPEECH_LANGUAGES = [
  { code: 'en-US', label: 'English (US)', short: 'EN' },
  { code: 'en-GB', label: 'English (UK)', short: 'UK' },
  { code: 'hi-IN', label: 'Hindi (हिन्दी)', short: 'HI' },
  { code: 'bn-IN', label: 'Bengali (বাংলা)', short: 'BN' },
  { code: 'ja-JP', label: 'Japanese (日本語)', short: 'JA' },
  { code: 'zh-CN', label: 'Chinese (中文)', short: 'ZH' },
  { code: 'ko-KR', label: 'Korean (한국어)', short: 'KO' },
  { code: 'es-ES', label: 'Spanish (Español)', short: 'ES' },
  { code: 'fr-FR', label: 'French (Français)', short: 'FR' },
  { code: 'de-DE', label: 'German (Deutsch)', short: 'DE' },
];

interface EtherealDialogueBarProps {
  lastSpokenText?: string;
  isSpeaking?: boolean;
  isGenerating: boolean;
  currentEmotion?: Emotion;
  speechLanguage?: string;
  currentLanguage?: ColumbinaLanguage;
  onSendMessage: (
    message: string,
    voiceAnalysis?: ParalinguisticAnalysis,
    image?: string,
    imageName?: string
  ) => void;
  onSendVoiceUtterance?: (
    rawText: string,
    language: string,
    voiceAnalysis?: ParalinguisticAnalysis
  ) => Promise<void>;
  onStopSpeaking?: () => void;
  onReplayAudio?: () => void;
  onListeningChange?: (isListening: boolean) => void;
  onLanguageChange?: (lang: string) => void;
  onColumbinaLanguageChange?: (lang: ColumbinaLanguage) => void;
}

export const EtherealDialogueBar: React.FC<EtherealDialogueBarProps> = ({
  lastSpokenText = '',
  isSpeaking = false,
  isGenerating,
  speechLanguage = 'en-US',
  currentLanguage = 'English',
  onSendMessage,
  onSendVoiceUtterance,
  onStopSpeaking,
  onListeningChange,
  onLanguageChange,
  onColumbinaLanguageChange,
}) => {
  const [inputText, setInputText] = useState('');
  const [interimSpeech, setInterimSpeech] = useState('');
  const [isMicActive, setIsMicActive] = useState(false);
  const [isValidatingVoice, setIsValidatingVoice] = useState(false);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [isBarHidden, setIsBarHidden] = useState(false);
  const [hasSpeechSupport, setHasSpeechSupport] = useState(true);
  const [selectedLang, setSelectedLang] = useState(speechLanguage || 'en-US');
  const [selectedImage, setSelectedImage] = useState<{
    base64: string;
    name: string;
    size: string;
  } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const isMicActiveRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isGeneratingRef = useRef(false);
  const onStopSpeakingRef = useRef(onStopSpeaking);
  const onSendMessageRef = useRef(onSendMessage);
  const onSendVoiceUtteranceRef = useRef(onSendVoiceUtterance);
  const selectedLangRef = useRef(selectedLang);
  const lastSpokenTextRef = useRef(lastSpokenText);

  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const turnHistoryRef = useRef<string>('');
  const sessionFinalRef = useRef<string>('');
  const sessionInterimRef = useRef<string>('');
  const pendingUtteranceRef = useRef<string>('');
  const isSubmittingRef = useRef<boolean>(false);
  const lastProcessedTextRef = useRef<string>('');
  const lastProcessedTimeRef = useRef<number>(0);

  // Helper to read and compress/format image file
  const processImageFile = useCallback((file: File) => {
    if (!file || !file.type.startsWith('image/')) return;

    // Check size limit (allow up to 20MB)
    if (file.size > 20 * 1024 * 1024) {
      alert('Photo is too large. Please select an image smaller than 20MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) return;

      // Check if image needs downscaling (if large)
      const img = new Image();
      img.onload = () => {
        const maxDimension = 1400;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.88);
            setSelectedImage({
              base64: optimizedBase64,
              name: file.name,
              size: (file.size / 1024).toFixed(0) + ' KB',
            });
            return;
          }
        }

        setSelectedImage({
          base64: result,
          name: file.name,
          size: (file.size / 1024).toFixed(0) + ' KB',
        });
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    // reset input value so re-uploading the same file triggers change
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    }
  };

  // Support clipboard paste for images
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file);
          break;
        }
      }
    }
  };

  // Keep refs updated for event callbacks
  useEffect(() => {
    isMicActiveRef.current = isMicActive;
    onListeningChange?.(isMicActive);
  }, [isMicActive, onListeningChange]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  useEffect(() => {
    onStopSpeakingRef.current = onStopSpeaking;
  }, [onStopSpeaking]);

  useEffect(() => {
    onSendMessageRef.current = onSendMessage;
  }, [onSendMessage]);

  useEffect(() => {
    onSendVoiceUtteranceRef.current = onSendVoiceUtterance;
  }, [onSendVoiceUtterance]);

  useEffect(() => {
    selectedLangRef.current = selectedLang;
  }, [selectedLang]);

  useEffect(() => {
    lastSpokenTextRef.current = lastSpokenText;
  }, [lastSpokenText]);

  // Sync prop changes for language
  useEffect(() => {
    if (speechLanguage && speechLanguage !== selectedLang) {
      setSelectedLang(speechLanguage);
      selectedLangRef.current = speechLanguage;
      if (recognitionRef.current) {
        recognitionRef.current.lang = speechLanguage;
      }
    }
  }, [speechLanguage, selectedLang]);

  // Safe starter that guards against browser InvalidStateError
  const safeStartRecognition = useCallback(() => {
    if (!recognitionRef.current || !isMicActiveRef.current) return;
    if (isGeneratingRef.current || isSpeakingRef.current) return;

    try {
      recognitionRef.current.start();
    } catch (err: any) {
      if (err?.name !== 'InvalidStateError') {
        console.warn('SpeechRecognition start error:', err);
      }
    }
  }, []);

  // Safe stopper
  const safeStopRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (e) {}
  }, []);

  // Reset all in-flight speech buffers
  const clearSpeechBuffers = useCallback(() => {
    turnHistoryRef.current = '';
    sessionFinalRef.current = '';
    sessionInterimRef.current = '';
    pendingUtteranceRef.current = '';
    setInterimSpeech('');
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // Commit recognized speech turn to Columbina
  const commitUserUtterance = useCallback(
    (rawText: string) => {
      if (isSubmittingRef.current) return;

      const fullCombined = mergeSpeechTranscripts([
        turnHistoryRef.current,
        rawText,
      ]).trim();

      const finalFormatted = cleanFinalTranscript(fullCombined);
      if (!finalFormatted || isNoiseTranscript(finalFormatted)) {
        clearSpeechBuffers();
        return;
      }

      if (isGeneratingRef.current || isSpeakingRef.current) {
        return;
      }

      // Prevent Columbina from hearing her own voice echo
      if (lastSpokenTextRef.current) {
        const normSpoken = normalizeForComparison(lastSpokenTextRef.current);
        const normIncoming = normalizeForComparison(finalFormatted);
        if (
          normSpoken &&
          normIncoming &&
          normIncoming.length > 8 &&
          (normSpoken.includes(normIncoming) || normIncoming.includes(normSpoken))
        ) {
          clearSpeechBuffers();
          return;
        }
      }

      // Prevent duplicate sends within 2500ms
      const now = Date.now();
      if (
        normalizeForComparison(finalFormatted) === normalizeForComparison(lastProcessedTextRef.current) &&
        now - lastProcessedTimeRef.current < 2500
      ) {
        clearSpeechBuffers();
        return;
      }

      // Lock submission immediately to prevent race conditions
      isSubmittingRef.current = true;
      lastProcessedTextRef.current = finalFormatted;
      lastProcessedTimeRef.current = now;

      // Clear buffers for next turn
      clearSpeechBuffers();

      // Temporarily pause recognition while Columbina generates response
      safeStopRecognition();

      // Analyze acoustics & paralinguistics (e.g. laughter, hmm, sigh, pitch, speed)
      let voiceAnalysis: ParalinguisticAnalysis | undefined;
      try {
        voiceAnalysis = voiceAnalysisService.analyzeUtterance(finalFormatted);
      } catch (e) {
        console.warn('Paralinguistic analysis error:', e);
      }

      if (onSendVoiceUtteranceRef.current) {
        setIsValidatingVoice(true);
        onSendVoiceUtteranceRef.current(finalFormatted, selectedLangRef.current, voiceAnalysis)
          .finally(() => {
            setIsValidatingVoice(false);
            isSubmittingRef.current = false;
          });
      } else {
        onSendMessageRef.current(finalFormatted, voiceAnalysis);
        isSubmittingRef.current = false;
      }
    },
    [clearSpeechBuffers, safeStopRecognition]
  );

  // Setup Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setHasSpeechSupport(false);
      return;
    }

    setHasSpeechSupport(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectedLangRef.current || 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setMicPermissionError(null);
    };

    recognition.onresult = (event: any) => {
      // Speech Interruption: If user starts speaking while Columbina is talking or thinking, interrupt immediately
      if (isSpeakingRef.current || isGeneratingRef.current) {
        onStopSpeakingRef.current?.();
      }

      // Extract all session finals and interims from current recognition session
      const finalParts: string[] = [];
      const interimParts: string[] = [];

      for (let i = 0; i < event.results.length; ++i) {
        const item = event.results[i];
        const text = (item[0]?.transcript || '').trim();
        if (!text) continue;
        if (item.isFinal) {
          finalParts.push(text);
        } else {
          interimParts.push(text);
        }
      }

      sessionFinalRef.current = finalParts.join(' ').trim();
      sessionInterimRef.current = interimParts.join(' ').trim();

      // Safely merge accumulated history + session finals + session interims
      const combinedSpeech = mergeSpeechTranscripts([
        turnHistoryRef.current,
        sessionFinalRef.current,
        sessionInterimRef.current,
      ]).trim();

      if (combinedSpeech) {
        pendingUtteranceRef.current = combinedSpeech;
        setInterimSpeech(combinedSpeech);

        // Turn Management: Reset silence detection timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        // Natural pause tolerance: dynamic delay (2200ms - 3000ms) prevents premature cutoffs
        const timeoutMs = getSilenceTimeoutForUtterance(combinedSpeech);
        silenceTimerRef.current = setTimeout(() => {
          if (pendingUtteranceRef.current && !isSubmittingRef.current) {
            commitUserUtterance(pendingUtteranceRef.current);
          }
        }, timeoutMs);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setMicPermissionError(
          'Microphone permission was denied. Please allow microphone access in your browser settings to talk with Columbina.'
        );
        setIsMicActive(false);
        isMicActiveRef.current = false;
      }
      // Note: 'no-speech' or 'network' transient events do not permanently turn off the mic
    };

    recognition.onend = () => {
      // When browser ends session (pause or buffer cycling), move session finals into turnHistory
      if (sessionFinalRef.current) {
        turnHistoryRef.current = mergeSpeechTranscripts([
          turnHistoryRef.current,
          sessionFinalRef.current,
        ]);
        sessionFinalRef.current = '';
        sessionInterimRef.current = '';
      }

      // Auto-restart if continuous microphone is still active and Columbina is not speaking/thinking
      if (isMicActiveRef.current && !isGeneratingRef.current && !isSpeakingRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (isMicActiveRef.current && !isGeneratingRef.current && !isSpeakingRef.current) {
            safeStartRecognition();
          }
        }, 50);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try {
        recognition.abort();
      } catch (e) {}
    };
  }, [clearSpeechBuffers, commitUserUtterance, safeStartRecognition]);

  // Auto-resume continuous listening when Columbina finishes speaking
  useEffect(() => {
    if (isMicActive && !isSpeaking && !isGenerating) {
      const timer = setTimeout(() => {
        if (isMicActiveRef.current && !isSpeakingRef.current && !isGeneratingRef.current) {
          safeStartRecognition();
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isMicActive, isSpeaking, isGenerating, safeStartRecognition]);

  // Microphone toggle button handler
  const toggleListening = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!hasSpeechSupport) {
      setMicPermissionError(
        'Speech recognition is not supported in this browser. Please open the app in Chrome, Edge, or Safari.'
      );
      return;
    }

    if (isMicActive) {
      // User clicked microphone again: turn OFF completely
      setIsMicActive(false);
      isMicActiveRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      safeStopRecognition();
      setInterimSpeech('');
      pendingUtteranceRef.current = '';
    } else {
      // User clicked microphone: turn ON continuously
      setMicPermissionError(null);
      setIsMicActive(true);
      isMicActiveRef.current = true;
      pendingUtteranceRef.current = '';
      if (isSpeaking) {
        onStopSpeakingRef.current?.();
      }
      safeStartRecognition();
    }
  };

  // Text message submit (for manual typing or photo sending)
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = inputText.trim();
    if ((!trimmed && !selectedImage) || isGenerating) return;

    if (isSpeaking) {
      onStopSpeakingRef.current?.();
    }

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    pendingUtteranceRef.current = '';
    setInterimSpeech('');

    safeStopRecognition();

    onSendMessage(
      trimmed,
      undefined,
      selectedImage?.base64,
      selectedImage?.name
    );
    setInputText('');
    setSelectedImage(null);
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="fixed inset-x-0 bottom-6 z-30 flex flex-col items-center pointer-events-none px-4"
    >
      {/* Hidden File Input for Photo Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
        id="photo-upload-file-input"
        aria-label="Upload photo file"
      />

      {/* Floating Capsule Input Bar */}
      {!isBarHidden ? (
        <div className="w-full max-w-md pointer-events-auto">
          {/* Permission Error Banner */}
          {micPermissionError && (
            <div className="mb-2 px-3 py-1.5 rounded-full bg-rose-950/85 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-2 shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="text-[11px] leading-tight">{micPermissionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setMicPermissionError(null)}
                className="text-rose-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Attached Image Preview Chip */}
          {selectedImage && (
            <div className="mb-2 px-3 py-1.5 rounded-2xl bg-neutral-900/95 border border-purple-500/50 text-neutral-200 text-xs flex items-center justify-between gap-2.5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="relative shrink-0">
                  <img
                    src={selectedImage.base64}
                    alt={selectedImage.name}
                    className="w-9 h-9 rounded-lg object-cover border border-purple-400/40 shadow-sm"
                  />
                  <span className="absolute -bottom-1 -right-1 flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-400"></span>
                  </span>
                </div>
                <div className="flex flex-col truncate text-left">
                  <span className="text-xs font-medium text-purple-200 truncate max-w-[200px] md:max-w-[240px]">
                    {selectedImage.name}
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    Photo attached • Ask Columbina anything about it
                  </span>
                </div>
              </div>
              <button
                type="button"
                id="remove-attached-photo-btn"
                onClick={() => setSelectedImage(null)}
                className="p-1.5 text-neutral-400 hover:text-rose-300 hover:bg-white/10 rounded-full transition shrink-0"
                title="Remove attached photo"
                aria-label="Remove attached photo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Real-time Voice Live Speech Indicator */}
          {interimSpeech && (
            <div className="mb-2 px-3.5 py-1.5 rounded-full bg-neutral-900/90 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 shadow-xl backdrop-blur-xl max-w-full">
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span className="truncate italic text-[11px] md:text-xs">"{interimSpeech}"</span>
              <span className="text-[10px] text-emerald-400/70 ml-auto shrink-0 font-medium">auto-sending...</span>
            </div>
          )}

          <form
            onSubmit={handleFormSubmit}
            onPaste={handlePaste}
            className={`flex items-center gap-1.5 md:gap-2 px-3 py-2 rounded-full bg-neutral-900/85 backdrop-blur-xl border ${
              isDraggingOver
                ? 'border-purple-400 ring-2 ring-purple-400/50 scale-[1.02]'
                : selectedImage
                ? 'border-purple-500/60 ring-1 ring-purple-500/30'
                : 'border-white/15'
            } shadow-2xl shadow-black/60 transition-all focus-within:border-purple-500/60 focus-within:ring-1 focus-within:ring-purple-500/40`}
          >
            {/* Photo Upload Button */}
            <button
              type="button"
              id="photo-upload-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isGenerating}
              className={`p-2 rounded-full transition flex items-center justify-center shrink-0 ${
                selectedImage
                  ? 'bg-purple-600/90 text-white shadow-md shadow-purple-900/50 ring-1 ring-purple-300/60'
                  : 'text-neutral-400 hover:text-purple-300 hover:bg-white/10'
              }`}
              title="Upload photo / image for Columbina to inspect"
              aria-label="Upload photo"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            {/* Voice Input Button */}
            <button
              type="button"
              id="voice-mic-toggle-button"
              onClick={toggleListening}
              className={`p-2 rounded-full transition flex items-center justify-center relative shrink-0 ${
                !isMicActive
                  ? 'text-neutral-400 hover:text-white hover:bg-white/10'
                  : isGenerating || isValidatingVoice
                  ? 'bg-purple-700/80 text-purple-200 border border-purple-400/50 animate-pulse shadow-md shadow-purple-900/40'
                  : isSpeaking
                  ? 'bg-purple-600 text-white animate-pulse ring-2 ring-purple-300 shadow-md shadow-purple-900/50'
                  : 'bg-emerald-600 text-white animate-pulse shadow-lg shadow-emerald-600/50 ring-2 ring-emerald-400/80'
              }`}
              title={
                !isMicActive
                  ? 'Microphone OFF. Click to start continuous voice conversation'
                  : isValidatingVoice
                  ? 'Understanding speech softly...'
                  : isGenerating
                  ? 'Columbina is thinking softly... (Continuous Mic Active)'
                  : isSpeaking
                  ? 'Columbina is speaking... (Click to interrupt / turn off)'
                  : 'Microphone LISTENING (Continuous). Speak naturally! Click to turn OFF'
              }
              aria-label={isMicActive ? 'Turn microphone off' : 'Turn microphone on'}
            >
              {!isMicActive ? (
                <Mic className="w-4 h-4" />
              ) : isGenerating || isValidatingVoice ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isSpeaking ? (
                <Volume2 className="w-4 h-4 animate-pulse" />
              ) : (
                <>
                  <Mic className="w-4 h-4 text-white" />
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                  </span>
                </>
              )}
            </button>

            {/* Message Input */}
            <input
              type="text"
              id="ethereal-chat-input"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
              }}
              placeholder={
                selectedImage
                  ? 'Ask Columbina about this photo... (or press send)'
                  : isValidatingVoice
                  ? 'Understanding speech softly...'
                  : !isMicActive
                  ? isGenerating
                    ? 'Columbina is thinking softly...'
                    : 'Ask Columbina anything, or share a photo...'
                  : isGenerating
                  ? 'Columbina is thinking softly...'
                  : isSpeaking
                  ? 'Columbina is speaking softly... (speak to interrupt)'
                  : interimSpeech
                  ? `Listening: "${interimSpeech}..."`
                  : 'Listening... speak naturally to Columbina (Auto-sends)'
              }
              disabled={isGenerating || isValidatingVoice}
              className="flex-1 min-w-0 bg-transparent border-none text-xs md:text-sm text-white placeholder-neutral-400 focus:outline-none px-1"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={(!inputText.trim() && !selectedImage) || isGenerating}
              className={`p-2 rounded-full transition shrink-0 ${
                (inputText.trim() || selectedImage) && !isGenerating
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/40'
                  : 'text-neutral-600 cursor-not-allowed'
              }`}
              title="Send message"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>

            {/* Hide Bar Button */}
            <button
              type="button"
              onClick={() => setIsBarHidden(true)}
              className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-white/5 rounded-full transition shrink-0"
              title="Hide Bar"
              aria-label="Hide Bar"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      ) : (
        /* Minimized Moon Button */
        <button
          onClick={() => setIsBarHidden(false)}
          className="pointer-events-auto p-2.5 rounded-full bg-neutral-900/70 hover:bg-neutral-900 backdrop-blur-md border border-white/10 text-purple-300 hover:text-white shadow-lg transition flex items-center gap-1.5 text-xs font-medium"
          title="Speak to Columbina"
        >
          <Moon className="w-4 h-4 text-purple-400" />
          <span>{isMicActive ? 'Listening...' : 'Speak'}</span>
        </button>
      )}
    </div>
  );
};

