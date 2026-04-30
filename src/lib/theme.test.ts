import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  THEMES,
  isThemeSlug,
  listThemes,
  resolveTheme,
  resolveThemeForRoute,
} from './theme';

describe('theme registry', () => {
  it('keeps the default theme registered', () => {
    expect(THEMES[DEFAULT_THEME]).toBeDefined();
  });

  it('lists all registered themes', () => {
    expect(listThemes()).toHaveLength(Object.keys(THEMES).length);
  });

  it('recognizes valid theme slugs only', () => {
    expect(isThemeSlug('terminal')).toBe(true);
    expect(isThemeSlug('missing-theme')).toBe(false);
    expect(isThemeSlug(null)).toBe(false);
  });

  it('resolves cookie theme before PocketBase theme', () => {
    expect(resolveTheme({ cookieValue: 'terminal', pbActiveTheme: 'paper' })).toBe('terminal');
  });

  it('falls back to default when no valid source exists', () => {
    expect(resolveTheme({ cookieValue: 'unknown', pbActiveTheme: 'also-unknown' })).toBe(DEFAULT_THEME);
  });

  it('falls back when route kind is unsupported', () => {
    expect(resolveThemeForRoute('terminal', 'diary')).toBe(DEFAULT_THEME);
    expect(resolveThemeForRoute('terminal', 'post')).toBe('terminal');
  });
});
