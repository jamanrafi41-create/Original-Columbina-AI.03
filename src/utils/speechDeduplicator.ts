/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Speech Recognition Deduplication, Merging & Artifact Cleaning Utility
 * Handles multi-part interim/final speech merging, pause detection, and non-destructive formatting.
 */

// Legitimate English/common words that can naturally be repeated consecutively in real speech
const LEGITIMATE_CONSECUTIVE_REPEATS = new Set([
  'that', // "I know that that is true"
  'had',  // "He had had a long day"
  'the',
  'very', // "very very good"
  'no',   // "no no no"
  'yes',  // "yes yes"
  'bye',  // "bye bye"
  'night',// "night night"
]);

/**
 * Normalizes unicode letters and numbers for comparison, stripping punctuation and diacritics
 */
export function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * Safely merges consecutive transcript fragments (such as across Web Speech API restarts
 * or between final and interim buffers) by eliminating overlapping tail/head words
 * without losing or altering any spoken words.
 */
export function mergeSpeechTranscripts(parts: string[]): string {
  const filtered = parts
    .map((p) => (p || '').trim().replace(/\s+/g, ' '))
    .filter((p) => p.length > 0);

  if (filtered.length === 0) return '';
  if (filtered.length === 1) return filtered[0];

  let merged = filtered[0];

  for (let p = 1; p < filtered.length; p++) {
    const nextPart = filtered[p];
    const mergedWords = merged.split(' ');
    const nextWords = nextPart.split(' ');

    let overlapWordCount = 0;
    const maxOverlap = Math.min(mergedWords.length, nextWords.length, 12);

    for (let count = maxOverlap; count >= 1; count--) {
      const mergedTail = mergedWords.slice(mergedWords.length - count).map(normalizeForComparison).join(' ');
      const nextHead = nextWords.slice(0, count).map(normalizeForComparison).join(' ');

      if (mergedTail && mergedTail === nextHead) {
        overlapWordCount = count;
        break;
      }
    }

    if (overlapWordCount > 0) {
      // Append only the non-overlapping portion of nextPart
      const nonOverlapping = nextWords.slice(overlapWordCount).join(' ');
      if (nonOverlapping) {
        merged = `${merged} ${nonOverlapping}`;
      }
    } else {
      // If nextPart is fully contained inside merged, ignore it
      const normMerged = normalizeForComparison(merged);
      const normNext = normalizeForComparison(nextPart);
      if (!normMerged.endsWith(normNext)) {
        merged = `${merged} ${nextPart}`;
      }
    }
  }

  return deduplicateTranscript(merged);
}

/**
 * Non-destructively deduplicates exact whole-phrase stutters produced by Web Speech API glitches.
 * Preserves all actual user words, slang, numbers, names, and vocabulary.
 */
export function deduplicateTranscript(raw: string): string {
  if (!raw || !raw.trim()) return '';

  let text = raw.trim().replace(/\s+/g, ' ');

  // 1. Check for exact full-sentence repetition
  // e.g. "what are you doing what are you doing" -> "what are you doing"
  const rawWords = text.split(' ');
  if (rawWords.length >= 4 && rawWords.length % 2 === 0) {
    const half = rawWords.length / 2;
    const firstHalfNorm = normalizeForComparison(rawWords.slice(0, half).join(' '));
    const secondHalfNorm = normalizeForComparison(rawWords.slice(half).join(' '));
    if (firstHalfNorm && firstHalfNorm === secondHalfNorm) {
      text = rawWords.slice(0, half).join(' ');
    }
  }

  // 2. Check for multi-word phrase repetitions (from 6 words down to 2 words)
  const currentWords = text.split(' ');
  for (let phraseLen = 6; phraseLen >= 2; phraseLen--) {
    if (currentWords.length < phraseLen * 2) continue;

    for (let i = 0; i <= currentWords.length - phraseLen * 2; i++) {
      const p1 = currentWords.slice(i, i + phraseLen).map(normalizeForComparison).join(' ');
      const p2 = currentWords.slice(i + phraseLen, i + phraseLen * 2).map(normalizeForComparison).join(' ');

      if (p1 && p1.length >= 3 && p1 === p2) {
        currentWords.splice(i + phraseLen, phraseLen);
        text = currentWords.join(' ');
        break;
      }
    }
  }

  return text.trim();
}

/**
 * Non-destructive final formatting:
 * Ensures proper capitalization and punctuation while strictly preserving every single word as spoken.
 */
export function cleanFinalTranscript(raw: string): string {
  let cleaned = deduplicateTranscript(raw).trim();
  if (!cleaned) return '';

  // Only fix obvious misrecognitions of the companion's name
  cleaned = cleaned.replace(/\b(colombina|kolumbina|columbine)\b/gi, 'Columbina');

  // Capitalize the first letter if lowercase
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // If no ending punctuation, add ? for questions or . for statements
  if (!/[.?!]$/.test(cleaned)) {
    const isQuestion = /^(what|why|how|where|when|who|which|whose|whom|is|are|am|do|does|did|can|could|will|would|shall|should|have|has|had|may|might)\b/i.test(cleaned);
    if (isQuestion) {
      cleaned += '?';
    } else {
      cleaned += '.';
    }
  }

  return cleaned;
}

/**
 * Returns dynamic silence timeout in milliseconds based on sentence completeness.
 * Gives user more pause time if they pause on conjunctions or in the middle of long thoughts.
 */
export function getSilenceTimeoutForUtterance(transcript: string): number {
  const trimmed = (transcript || '').trim();
  if (!trimmed) return 2200;

  const words = trimmed.split(/\s+/);
  const lastWord = normalizeForComparison(words[words.length - 1] || '');

  // Conjunctions/prepositions signaling the user has more to say:
  const continuationWords = new Set([
    'and', 'or', 'because', 'so', 'but', 'that', 'which', 'if', 'to',
    'with', 'for', 'about', 'like', 'when', 'where', 'while', 'since',
    'then', 'as', 'than', 'though', 'although', 'whether', 'into', 'from'
  ]);

  if (continuationWords.has(lastWord)) {
    return 3000; // Extra pause room for mid-sentence contemplation
  }

  // Short 1-2 word utterances
  if (words.length <= 2) {
    return 1900;
  }

  // Normal conversational sentence
  return 2200;
}

/**
 * Checks if a recognized string is pure background noise or accidental microphone glitch.
 */
export function isNoiseTranscript(raw: string): boolean {
  const trimmed = (raw || '').trim();
  if (!trimmed) return true;

  // Single punctuation/symbols only
  if (/^[\p{P}\p{S}\s]+$/u.test(trimmed)) return true;

  // Recognized vocal expressions that are NOT noise
  const legitimateVocalSounds = new Set([
    'hmm', 'hmmm', 'mmm', 'hmph', 'hmp', 'uh', 'uhh', 'um', 'umm',
    'ah', 'ahh', 'oh', 'ohh', 'wow', 'sigh', 'haha', 'hahaha', 'hehe', 'tsk'
  ]);

  const pureNorm = normalizeForComparison(trimmed);
  if (legitimateVocalSounds.has(pureNorm)) {
    return false;
  }

  // Common valid short words across supported languages (never reject these!)
  const validShortWords = new Set([
    'hi', 'no', 'ok', 'go', 'me', 'we', 'he', 'do', 'so', 'up', 'on', 'in',
    'to', 'am', 'is', 'it', 'at', 'my', 'by', 'us', 'ah', 'oh', 'yes', 'i',
    'ya', 'yo', 'ha', 'na', 'si', 'da', 'ne', 'ja'
  ]);

  const words = trimmed.split(/\s+/);

  // If it's a non-Latin script (Hindi, Bengali, Japanese, Chinese, Korean, Cyrillic, etc.), do not reject as noise
  const isNonLatin = /[^\x00-\x7F]/.test(trimmed);
  if (isNonLatin) {
    return trimmed.length < 1;
  }

  // If a single letter that is not a valid word (e.g. "b", "c", "d", "e", "f", "g", "k", "p", "s", "t", "x", "z")
  if (words.length === 1) {
    const single = pureNorm;
    if (single.length === 1 && !validShortWords.has(single)) {
      return true;
    }
  }

  // Pure repetitive filler sounds alone like "uhhhh" or "ummmm"
  const pureFillerPattern = /^(uh+|um+|hm+|err+|ah+|huh+|shh+|mhm+|tsk+|oh+)$/i;
  if (words.length === 1 && pureFillerPattern.test(words[0])) {
    return true;
  }

  return false;
}
