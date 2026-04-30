import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESET, PRESETS, listPresets, resolvePreset } from './bento-presets';

const validTileIds = new Set([
  'hero',
  'latest-article',
  'profile',
  'music',
  'diaries',
  'tags',
  'notes',
  'more-articles',
  'footer',
]);

describe('bento presets', () => {
  it('keeps the default preset registered', () => {
    expect(PRESETS[DEFAULT_PRESET]).toBeDefined();
  });

  it('returns default preset for invalid IDs', () => {
    expect(resolvePreset('missing').id).toBe(DEFAULT_PRESET);
    expect(resolvePreset(null).id).toBe(DEFAULT_PRESET);
  });

  it('lists all registered presets', () => {
    expect(listPresets()).toHaveLength(Object.keys(PRESETS).length);
  });

  it('uses only supported tiles with sane spans', () => {
    for (const preset of listPresets()) {
      expect(preset.tiles.length).toBeGreaterThan(0);
      for (const tile of preset.tiles) {
        expect(validTileIds.has(tile.id)).toBe(true);
        expect(tile.span).toBeGreaterThan(0);
        expect(tile.span).toBeLessThanOrEqual(12);
        if (tile.rowSpan !== undefined) expect(tile.rowSpan).toBeGreaterThan(0);
      }
    }
  });
});
