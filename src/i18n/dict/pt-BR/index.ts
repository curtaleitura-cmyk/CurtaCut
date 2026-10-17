import { EN } from '../en';
import EN_DATA from '../en/templates-data';
import curtacut from './curtacut';
import core from './core';
import editing from './editing';
import exportCopy from './export';
import settings from './settings';

// The upstream Chinese keys remain stable. English fallback covers every
// upstream UI entry while Portuguese is expanded incrementally.
const translations: Record<string, string> = { ...curtacut, ...core, ...editing, ...exportCopy, ...settings };
export const PT_BR: Record<string, string> = Object.fromEntries(
  Object.entries(EN).flatMap(([key, english]) => translations[english] === undefined ? [] : [[key, translations[english]]]),
);
export const PT_BR_DATA: Record<string, string> = {
  ...translations,
  ...Object.fromEntries(Object.entries(EN_DATA).flatMap(([key, english]) =>
    translations[english] === undefined ? [] : [[key, translations[english]]])),
};
