/** Whisper uses pt for all Portuguese variants, including Brazilian speech. */
export const DEFAULT_TRANSCRIPTION_LANGUAGE = 'pt';

/** Transformers.js detects the language when the language option is absent. */
export function browserWhisperLanguageOptions(language: string): { language?: string } {
  const value = language.trim().toLowerCase();
  if (!value || value === 'auto' || value === 'autodetect') return {};
  return { language: value === 'por' || value.startsWith('pt') ? 'pt' : value };
}
