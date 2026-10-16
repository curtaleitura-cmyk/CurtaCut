import { t } from '../i18n/locale';

/** Localize only system-created names, without rewriting saved projects/user names. */
export function versionDisplayName(version: { name: string; automatic?: boolean }): string {
  if (version.automatic && ['自动保存', 'Autosave', 'Auto save'].includes(version.name)) {
    return t('自动保存');
  }
  return version.name;
}
