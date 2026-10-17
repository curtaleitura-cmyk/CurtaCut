import assert from 'node:assert/strict';

const saved = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) },
});
Object.defineProperty(globalThis, 'document', {
  configurable: true, value: { documentElement: { lang: '' } },
});
const { getLocale, ensureLocaleDict, setLocale, t, tData, localeLanguageName } = await import('./locale');
const { EN } = await import('./dict/en');
const { PT_BR } = await import('./dict/pt-BR');
const { versionDisplayName } = await import('../persist/versionDisplayName');
const { parseUiLocale, localized } = await import('../../server/ui-locale');
assert.equal(getLocale(), 'pt-BR', 'new installations default to Brazilian Portuguese');
assert.equal(document.documentElement.lang, 'pt-BR');
assert.equal(t('导出'), EN['导出'], 'English is available before lazy loading');
await ensureLocaleDict('pt-BR');
assert.equal(t('自动保存'), 'Salvamento automático');
assert.equal(localeLanguageName('pt-BR'), 'Brazilian Portuguese');
assert.equal(versionDisplayName({ name: '自动保存', automatic: true }), 'Salvamento automático');
assert.equal(versionDisplayName({ name: '自动保存', automatic: false }), '自动保存', 'custom version names are preserved');
assert.equal(versionDisplayName({ name: 'Meu corte', automatic: true }), 'Meu corte');
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
for (const [key, translated] of Object.entries(PT_BR)) {
  assert.deepEqual(placeholders(translated), placeholders(EN[key]!), `placeholders: ${key}`);
}
assert.ok(Object.keys(PT_BR).length > 350, 'Portuguese covers the main editor controls');
for (const key of Object.keys(EN)) assert.doesNotMatch(t(key), /[\u3400-\u9fff]/u, `Chinese UI fallback: ${key}`);
const fallback = Object.keys(EN).find(key => !(key in PT_BR))!;
assert.equal(t(fallback), EN[fallback]);
assert.equal(t('Untitled project'), 'Projeto sem título');
assert.equal(t('Sequence {n}', { n: 1 }), 'Sequência 1');
assert.equal(t('Long Video to Shorts'), 'Vídeo longo em vídeos curtos');
assert.doesNotMatch(t('把一条长播客、访谈、课程或直播剪成适合社媒发布的短视频和高光。'), /[\u3400-\u9fff]/u);
assert.equal(tData('Meu projeto'), 'Meu projeto', 'user data is preserved');
assert.equal(parseUiLocale('pt-BR'), 'pt-BR');
assert.equal(parseUiLocale('pt'), 'pt-BR');
assert.equal(localized({ zh: '中文', en: 'English' }, 'pt-BR'), 'English');
assert.equal(localized({ zh: '中文', en: 'English', 'pt-BR': 'Português' }, 'pt-BR'), 'Português');
setLocale('en');
await ensureLocaleDict('en');
assert.equal(t('自动保存'), 'Autosave');
assert.equal(versionDisplayName({ name: '自动保存', automatic: true }), 'Autosave');
setLocale('pt-BR');
assert.equal(saved.get('cc.locale'), 'pt-BR');
assert.equal(document.documentElement.lang, 'pt-BR');
console.log(`pt-br.verify: ${Object.keys(PT_BR).length} Portuguese entries; ${Object.keys(EN).length} UI entries have English fallback; automatic names and user data verified`);
