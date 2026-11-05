import type { ComponentType } from 'react';

export interface WinCtx {
  id: string;
  props: Record<string, any>;
  setTitle(t: string): void;
  close(): void;
  focused: boolean;
}

export interface AppDef {
  id: string;
  name: string;
  icon: string;
  component?: ComponentType<{ win: WinCtx }>;
  /** Apps that build their own windows (the koalOS suite) launch through run() instead of a component. */
  run?: (args: Record<string, unknown>) => void;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  resizable?: boolean;
  maximizable?: boolean;
  singleton?: boolean;
  noTaskbar?: boolean;
  hidden?: boolean; // not listed in All Programs
  adminOnly?: boolean;
  category?: 'main' | 'accessories' | 'system' | 'games' | 'koal' | 'koalos';
  description?: string;
}

export const registry: Record<string, AppDef> = {};

export function registerApp(def: AppDef) {
  registry[def.id] = def;
}
