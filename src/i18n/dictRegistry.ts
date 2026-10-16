import { EN } from './dict/en';
import EN_DATA from './dict/en/templates-data';
// English is always available, including during lazy loading or a failed fetch.
// Other dictionaries are loaded on demand to keep the entry chunk small.
import type { Locale } from './locale';

export interface LocaleDicts {
  /** UI copy for the active locale. */
  readonly ui: Record<string, string>;
  /** UI copy consulted when `ui` has no entry (Italian falls back to English). */
  readonly uiFallback: Record<string, string>;
  /** Display names for **data** (template/sound/music names). */
  readonly data: Record<string, string>;
  /** Data names consulted when `data` has no entry. */
  readonly dataFallback: Record<string, string>;
}

const EMPTY: Record<string, string> = Object.freeze({});

/** Nothing loaded: non-Chinese locales immediately use English. */
const NONE: LocaleDicts = Object.freeze({
  ui: EMPTY, uiFallback: EN, data: EMPTY, dataFallback: EN_DATA,
});

// Replaced, never mutated, so a lookup mid-load sees one consistent snapshot.
let loaded: Readonly<Partial<Record<Locale, LocaleDicts>>> = {};
const inFlight = new Map<Locale, Promise<void>>();

async function fetchDicts(locale: Locale): Promise<LocaleDicts> {
  if (locale === 'zh') {
    // Chinese IS the key language, so only the data names need a table.
    const { ZH_DATA } = await import('./dict/zh');
    return { ui: EMPTY, uiFallback: EMPTY, data: ZH_DATA, dataFallback: EMPTY };
  }
  if (locale === 'en') return { ui: EN, uiFallback: EMPTY, data: EN_DATA, dataFallback: EMPTY };
  if (locale === 'pt-BR') {
    const { PT_BR, PT_BR_DATA } = await import('./dict/pt-BR');
    return { ui: PT_BR, uiFallback: EN, data: PT_BR_DATA, dataFallback: EN_DATA };
  }
  if (locale === 'ru') {
    // Russian uses the same English fallback as Portuguese and Italian.
    const [ru, enData] = await Promise.all([
      import('./dict/ru'), import('./dict/en/templates-data'),
    ]);
    return { ui: ru.RU, uiFallback: EN, data: enData.default, dataFallback: EMPTY };
  }
  const [it, itData, en, enData] = await Promise.all([
    import('./dict/it'), import('./dict/it/templates-data'),
    import('./dict/en'), import('./dict/en/templates-data'),
  ]);
  return { ui: it.IT, uiFallback: en.EN, data: itData.default, dataFallback: enData.default };
}

/** The dictionaries currently in memory for `locale` (empty until loaded). */
export function localeDicts(locale: Locale): LocaleDicts {
  return loaded[locale] ?? (locale === 'zh' ? { ui: EMPTY, uiFallback: EMPTY, data: EMPTY, dataFallback: EMPTY } : NONE);
}

/** True once `locale`'s dictionaries are in memory and lookups are complete. */
export function localeDictReady(locale: Locale): boolean {
  return loaded[locale] !== undefined;
}

/** Load `locale`'s dictionaries once; concurrent callers share the same fetch. */
export function ensureLocaleDict(locale: Locale): Promise<void> {
  const pending = inFlight.get(locale);
  if (pending) return pending;
  const task = fetchDicts(locale)
    .then((dicts) => { loaded = { ...loaded, [locale]: dicts }; })
    .catch(() => {
      // A failed chunk fetch (offline, stale deploy) must not blank the UI —
      // t() keeps returning English for non-Chinese locales. Drop the memo so switching
      // back to this locale retries instead of being stuck on the failure.
      inFlight.delete(locale);
    });
  inFlight.set(locale, task);
  return task;
}
