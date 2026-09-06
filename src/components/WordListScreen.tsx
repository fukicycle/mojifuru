import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface WordEntry {
  word: string;
  kana: string;
  length: number;
}

const GOJUON_GROUPS: readonly [label: string, chars: string][] = [
  ['あ', 'あいうえお'],
  ['か', 'かきくけこがぎぐげご'],
  ['さ', 'さしすせそざじずぜぞ'],
  ['た', 'たちつてとだぢづでど'],
  ['な', 'なにぬねの'],
  ['は', 'はひふへほばびぶべぼぱぴぷぺぽ'],
  ['ま', 'まみむめも'],
  ['や', 'やゆよ'],
  ['ら', 'らりるれろ'],
  ['わ', 'わをん'],
];

const ROW_HEIGHT = 40;

export default function WordListScreen() {
  const navigate = useNavigate();
  const [words, setWords] = useState<WordEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lengthFilter, setLengthFilter] = useState<number | 'all'>('all');
  const [gojuonFilter, setGojuonFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(400);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}wordlist.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((data: WordEntry[]) => setWords(data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    if (containerRef.current) setContainerHeight(containerRef.current.clientHeight);
  }, [words]);

  const filtered = useMemo(() => {
    if (!words) return [];
    let list = words;
    if (lengthFilter !== 'all') list = list.filter((w) => w.length === lengthFilter);
    if (gojuonFilter) list = list.filter((w) => gojuonFilter.includes(w.kana[0]));
    const q = search.trim();
    if (q) list = list.filter((w) => w.word.includes(q) || w.kana.includes(q));
    return list;
  }, [words, lengthFilter, gojuonFilter, search]);

  const totalHeight = filtered.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 4);
  const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + 8;
  const endIndex = Math.min(filtered.length, startIndex + visibleCount);
  const visibleRows = filtered.slice(startIndex, endIndex);

  return (
    <div className="screen">
      <h2>単語一覧</h2>
      <input
        className="text-input"
        placeholder="単語やかなで検索"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="tab-row">
        <button className={`tab-button ${lengthFilter === 'all' ? 'is-active' : ''}`} onClick={() => setLengthFilter('all')}>
          すべて
        </button>
        {[2, 3, 4, 5, 6, 7, 8].map((len) => (
          <button key={len} className={`tab-button ${lengthFilter === len ? 'is-active' : ''}`} onClick={() => setLengthFilter(len)}>
            {len}文字
          </button>
        ))}
      </div>

      <div className="tab-row">
        <button className={`tab-button ${gojuonFilter === null ? 'is-active' : ''}`} onClick={() => setGojuonFilter(null)}>
          全行
        </button>
        {GOJUON_GROUPS.map(([label, chars]) => (
          <button
            key={label}
            className={`tab-button ${gojuonFilter === chars ? 'is-active' : ''}`}
            onClick={() => setGojuonFilter(chars)}
          >
            {label}行
          </button>
        ))}
      </div>

      {error && <p style={{ color: 'crimson' }}>読み込みに失敗しました: {error}</p>}
      {!error && !words && <p>読み込み中...(約{'2万'}語)</p>}

      {words && (
        <>
          <p style={{ fontSize: 12, color: 'var(--text-soft)' }}>{filtered.length}件</p>
          <div
            className="virtual-list"
            ref={containerRef}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          >
            <div style={{ height: totalHeight, position: 'relative' }}>
              {visibleRows.map((w, i) => (
                <div
                  key={startIndex + i}
                  className="virtual-list-row"
                  style={{ position: 'absolute', top: (startIndex + i) * ROW_HEIGHT, left: 0, right: 0, height: ROW_HEIGHT }}
                >
                  <span>{w.word}</span>
                  <span style={{ color: 'var(--text-soft)' }}>{w.kana}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <button className="button button--ghost button--block" onClick={() => navigate('/')}>
        タイトルへもどる
      </button>
    </div>
  );
}
