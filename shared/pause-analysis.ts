/** Source-time audio evidence. Silence is an amplitude observation, not a speech verdict. */
export interface AudioQuietSpan { startMs: number; endMs: number }
export interface PauseSettings {
  enabled: boolean;
  minSilenceMs: number;
  thresholdDb: number;
  paddingMs: number;
  showPauses: boolean;
}
export const DEFAULT_PAUSE_SETTINGS: PauseSettings = {
  enabled: true, minSilenceMs: 500, thresholdDb: -35, paddingMs: 150, showPauses: true,
};
export interface PauseAnalysis {
  version: 1;
  sourceRevision: string;
  durationMs: number;
  thresholdDb: number;
  minSilenceMs: number;
  quiet: AudioQuietSpan[];
  analyzedAt: number;
}
export function normalizePauseSettings(value: Partial<PauseSettings>): PauseSettings {
  const clamp = (v: unknown, fallback: number, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  return {
    enabled: value.enabled !== false,
    showPauses: value.showPauses !== false,
    minSilenceMs: clamp(value.minSilenceMs, 500, 200, 10000),
    thresholdDb: clamp(value.thresholdDb, -35, -80, -10),
    paddingMs: clamp(value.paddingMs, 150, 0, 1000),
  };
}
/** Incremental FFmpeg stderr parser; callers feed complete lines. */
export class SilenceLogParser {
  quiet: AudioQuietSpan[] = [];
  private start: number | undefined;
  feed(line: string) {
    const start = line.match(/silence_start:\s*([\d.e+-]+)/);
    const end = line.match(/silence_end:\s*([\d.e+-]+)/);
    if (start && Number.isFinite(Number(start[1]))) this.start = Math.max(0, Number(start[1]) * 1000);
    if (end && this.start !== undefined && Number.isFinite(Number(end[1]))) {
      const endMs = Number(end[1]) * 1000;
      if (endMs > this.start) this.quiet.push({ startMs: this.start, endMs });
      this.start = undefined;
    }
  }
  finish(durationMs: number) {
    if (this.start !== undefined && durationMs > this.start) this.quiet.push({ startMs: this.start, endMs: durationMs });
    this.start = undefined;
    return this.quiet.map(s => ({ startMs: Math.max(0, s.startMs), endMs: Math.min(durationMs, s.endMs) })).filter(s => s.endMs > s.startMs);
  }
}
