import { DEFAULT_PAUSE_SETTINGS, normalizePauseSettings, type PauseSettings } from '../../shared/pause-analysis';
const KEY = 'cc.pauseSettings';
export const PAUSE_SETTINGS_EVENT = 'cc-pause-settings';
export function readPauseSettings(): PauseSettings {
  try { return normalizePauseSettings(JSON.parse(localStorage.getItem(KEY) ?? '{}')); }
  catch { return { ...DEFAULT_PAUSE_SETTINGS }; }
}
export function savePauseSettings(value: PauseSettings) {
  const settings = normalizePauseSettings(value);
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* session preference still updates */ }
  window.dispatchEvent(new CustomEvent(PAUSE_SETTINGS_EVENT, { detail: settings }));
}
