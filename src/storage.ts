import type { ProgramDoc } from './turtle/types';

const KEY = 'turtle-studio-v1';

export interface SaveData {
  level: number;
  completed: number[];
  bestBlocks: Record<number, number>;
  programs: Record<number, ProgramDoc>;
  muted: boolean;
}

const fresh = (): SaveData => ({
  level: 1,
  completed: [],
  bestBlocks: {},
  programs: {},
  muted: false,
});

export function loadSave(): SaveData {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<SaveData> | null;
    if (!raw || typeof raw !== 'object') return fresh();
    return {
      level: Number.isInteger(raw.level) ? raw.level! : 1,
      completed: Array.isArray(raw.completed) ? raw.completed.filter(Number.isInteger) : [],
      bestBlocks: raw.bestBlocks && typeof raw.bestBlocks === 'object' ? raw.bestBlocks : {},
      programs: raw.programs && typeof raw.programs === 'object' ? raw.programs : {},
      muted: raw.muted === true,
    };
  } catch {
    return fresh();
  }
}

export function writeSave(save: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Ignore storage errors.
  }
}
