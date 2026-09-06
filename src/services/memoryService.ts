/**
 * Memory Service for Character AI Brain
 * Handles short-term context and long-term user memory.
 * Designed with a clean interface so Firebase / Cloud DB persistence
 * can be plugged in seamlessly.
 */

import { CharacterMemory } from '../types';
import { firebaseService } from './firebaseService';

const STORAGE_KEY_PREFIX = 'vrm_character_memory_columbina_v1';

const DEFAULT_MEMORY: CharacterMemory = {
  userPreferences: [
    'Enjoys gentle, quiet, and meaningful conversations',
  ],
  importantFacts: [],
  relationshipContext: [
    'Speaks with Columbina Hyposelenia (Kuutar, formerly The Damselette, Third of the Fatui Harbingers; now Moon Maiden / Trilune Goddess of Silvermoon Hall, Hiisi Island, Nod-Krai)',
    'Columbina is gradually getting to know the user as a trusted companion, curious about ordinary life and genuine friendship',
  ],
  conversationSummary: '',
};

export class MemoryService {
  private memory: CharacterMemory;
  private activeUid: string | null = null;

  constructor() {
    this.memory = { ...DEFAULT_MEMORY };
  }

  public getStorageKey(): string {
    return this.activeUid ? `${STORAGE_KEY_PREFIX}_${this.activeUid}` : `${STORAGE_KEY_PREFIX}_anon`;
  }

  public async setActiveUser(uid: string | null): Promise<CharacterMemory> {
    this.activeUid = uid;
    if (!uid) {
      this.memory = this.loadLocal();
      return this.getMemory();
    }

    // Try loading from Firestore first
    const firestoreMemory = await firebaseService.getUserMemory(uid);
    if (firestoreMemory) {
      this.memory = {
        userPreferences: Array.isArray(firestoreMemory.userPreferences) ? firestoreMemory.userPreferences : [],
        importantFacts: Array.isArray(firestoreMemory.importantFacts) ? firestoreMemory.importantFacts : [],
        relationshipContext: Array.isArray(firestoreMemory.relationshipContext) ? firestoreMemory.relationshipContext : [],
        conversationSummary: typeof firestoreMemory.conversationSummary === 'string' ? firestoreMemory.conversationSummary : '',
      };
      this.saveLocal(this.memory);
    } else {
      // Fallback to local memory for this UID or default
      this.memory = this.loadLocal();
      await this.save(this.memory);
    }

    return this.getMemory();
  }

  public clearActiveUser(): void {
    this.activeUid = null;
    this.memory = { ...DEFAULT_MEMORY };
  }

  private loadLocal(): CharacterMemory {
    try {
      const stored = localStorage.getItem(this.getStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          userPreferences: Array.isArray(parsed.userPreferences) ? parsed.userPreferences : [],
          importantFacts: Array.isArray(parsed.importantFacts) ? parsed.importantFacts : [],
          relationshipContext: Array.isArray(parsed.relationshipContext) ? parsed.relationshipContext : [],
          conversationSummary: typeof parsed.conversationSummary === 'string' ? parsed.conversationSummary : '',
        };
      }
    } catch (e) {
      console.warn('Failed to load character memory from storage:', e);
    }
    return { ...DEFAULT_MEMORY };
  }

  private saveLocal(memory: CharacterMemory): void {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(memory));
    } catch (e) {
      console.warn('Failed to persist local character memory:', e);
    }
  }

  public async save(memory: CharacterMemory): Promise<void> {
    this.memory = memory;
    this.saveLocal(memory);

    if (this.activeUid) {
      await firebaseService.saveUserMemory(this.activeUid, memory);
    }
  }

  public getMemory(): CharacterMemory {
    return { ...this.memory };
  }

  public async addPreference(preference: string): Promise<void> {
    const trimmed = preference.trim();
    if (trimmed && !this.memory.userPreferences.includes(trimmed)) {
      this.memory.userPreferences.push(trimmed);
      await this.save(this.memory);
    }
  }

  public async addFact(fact: string): Promise<void> {
    const trimmed = fact.trim();
    if (trimmed && !this.memory.importantFacts.includes(trimmed)) {
      this.memory.importantFacts.push(trimmed);
      await this.save(this.memory);
    }
  }

  public async addRelationshipNote(note: string): Promise<void> {
    const trimmed = note.trim();
    if (trimmed && !this.memory.relationshipContext.includes(trimmed)) {
      this.memory.relationshipContext.push(trimmed);
      await this.save(this.memory);
    }
  }

  public async updateSummary(summary: string): Promise<void> {
    this.memory.conversationSummary = summary.trim();
    await this.save(this.memory);
  }

  public async clear(): Promise<void> {
    this.memory = { ...DEFAULT_MEMORY };
    await this.save(this.memory);
  }

  public async clearMemory(): Promise<void> {
    await this.clear();
  }
}

export const memoryService = new MemoryService();

