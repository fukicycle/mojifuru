import { describe, expect, it } from 'vitest';
import { compareVersions, notesSince, RELEASE_NOTES, type ReleaseNote } from './releaseNotes';

const notes: ReleaseNote[] = [
  { version: '0.9.6', items: ['ろくのこと'] },
  { version: '0.9.8', items: ['はちのこと'] },
  { version: '0.9.9', items: ['きゅうのこと'] },
  { version: '0.9.10', items: ['じゅうのこと'] },
];

describe('compareVersions', () => {
  it('桁ごとに数値として比べる(文字列比較では逆転する組み合わせ)', () => {
    expect(compareVersions('0.9.10', '0.9.9')).toBeGreaterThan(0);
    expect(compareVersions('0.9.9', '0.9.10')).toBeLessThan(0);
    expect(compareVersions('0.10.0', '0.9.99')).toBeGreaterThan(0);
  });

  it('同じバージョンは0', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });

  it('桁数が違っても比べられる', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.2', '1.2.1')).toBeLessThan(0);
  });
});

describe('notesSince', () => {
  it('バージョンを飛ばして更新しても、その間の変更点をまとめて返す', () => {
    expect(notesSince(notes, '0.9.8', '0.9.10').map((n) => n.version)).toEqual(['0.9.10', '0.9.9']);
  });

  it('前回見たバージョン自身は含めない', () => {
    expect(notesSince(notes, '0.9.9', '0.9.10').map((n) => n.version)).toEqual(['0.9.10']);
  });

  it('現在のバージョンより新しいノート(書きかけの次版など)は出さない', () => {
    expect(notesSince(notes, '0.9.8', '0.9.9').map((n) => n.version)).toEqual(['0.9.9']);
  });

  it('初回インストール(記録なし)では何も返さない', () => {
    expect(notesSince(notes, null, '0.9.10')).toEqual([]);
  });

  it('更新がなければ空(同じバージョンで起動しただけ)', () => {
    expect(notesSince(notes, '0.9.10', '0.9.10')).toEqual([]);
  });

  it('巻き戻し(現在が前回より古い)でも何も出さない', () => {
    expect(notesSince(notes, '0.9.10', '0.9.9')).toEqual([]);
  });
});

describe('RELEASE_NOTES', () => {
  it('バージョンが重複していない', () => {
    const versions = RELEASE_NOTES.map((n) => n.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('項目が空のノートがない', () => {
    expect(RELEASE_NOTES.every((n) => n.items.length > 0)).toBe(true);
  });
});
