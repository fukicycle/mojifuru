import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameContext } from '../context/GameContext';
import { ensureSignedIn } from '../firebase/config';
import { fetchWordCollection, type WordCollection } from '../firebase/wordCollection';
import { isRareWord } from '../game/rareWords';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { ChipLoader, ChipTitle, DecoChips, EmptyChip, WordChips } from './decor';

interface WordEntry {
  word: string;
  kana: string;
  length: number;
}

interface CollectedWord {
  kana: string;
  /** 漢字をふくむ表示用の表記(辞書に無ければ読みそのまま) */
  display: string;
  foundAt: number;
  rare: boolean;
}

const ROW_HEIGHT = 44;

/** 見つけた日(「9/15」)。年は出さない(古い記録でも行が窮屈にならないように) */
function formatFoundAt(at: number): string {
  if (!at) return '';
  const date = new Date(at);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 単語ずかん。これまでに成立させた単語がたまっていく画面。
 *
 * 期限も義務もなく増えるだけの記録なので、ひさしぶりに開いても減っていない。
 * 「まえ来たときより増えてるかな」と覗きにくるための画面として作っている。
 */
export default function CollectionScreen() {
  useDocumentMeta('ずかん', 'もじふるで これまでに作った単語がたまっていく「ずかん」です。');
  const navigate = useNavigate();
  const { firebaseEnabled } = useGameContext();

  const [collection, setCollection] = useState<WordCollection | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  // 表示用の表記(漢字)と「ぜんぶで何語あるか」のために、単語一覧と同じデータを読む
  const [dictionary, setDictionary] = useState<Map<string, string> | null>(null);
  const [lengthFilter, setLengthFilter] = useState<number | 'all'>('all');
  const [rareOnly, setRareOnly] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(400);

  useEffect(() => {
    if (!firebaseEnabled) return;
    let cancelled = false;
    ensureSignedIn()
      .then(fetchWordCollection)
      .then((value) => {
        if (!cancelled) setCollection(value);
      })
      .catch((err: unknown) => {
        if (!cancelled) setCollectionError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseEnabled]);

  useEffect(() => {
    if (!firebaseEnabled) return;
    // 単語一覧と同じく、重いfetch+JSON.parseはワーカーへ逃がす(画面が固まって見えないように)
    const worker = new Worker(new URL('../workers/wordlistWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ ok: true; data: WordEntry[] } | { ok: false; error: string }>) => {
      if (e.data.ok) {
        const map = new Map<string, string>();
        // 同じ読みに複数の表記があるときは、先に現れたものを代表にする
        for (const entry of e.data.data) if (!map.has(entry.kana)) map.set(entry.kana, entry.word);
        setDictionary(map);
      }
      worker.terminate();
    };
    worker.onerror = () => worker.terminate();
    worker.postMessage(`${import.meta.env.BASE_URL}wordlist.json`);
    return () => worker.terminate();
  }, [firebaseEnabled]);

  useEffect(() => {
    if (containerRef.current) setContainerHeight(containerRef.current.clientHeight);
  }, [collection]);

  const collected = useMemo<CollectedWord[]>(() => {
    if (!collection) return [];
    return Object.entries(collection)
      .map(([kana, foundAt]) => ({
        kana,
        display: dictionary?.get(kana) ?? kana,
        foundAt,
        rare: isRareWord(kana),
      }))
      // 見つけたのが新しい順。ひさしぶりに開いたとき、増えたぶんが上に来るようにする
      .sort((a, b) => b.foundAt - a.foundAt);
  }, [collection, dictionary]);

  const rareCount = collected.filter((w) => w.rare).length;

  const filtered = useMemo(() => {
    let list = collected;
    if (lengthFilter !== 'all') list = list.filter((w) => w.kana.length === lengthFilter);
    if (rareOnly) list = list.filter((w) => w.rare);
    return list;
  }, [collected, lengthFilter, rareOnly]);

  if (!firebaseEnabled) {
    return (
      <div className="screen screen--center screen--decorated">
        <DecoChips />
        <ChipTitle text="ずかん" />
        <p style={{ color: 'var(--text-soft)' }}>
          ずかんの記録には Firebase の設定が必要です(.env.local を参照)。
        </p>
        <button className="button button--ghost button--block" onClick={() => navigate('/')}>
          タイトルへもどる
        </button>
      </div>
    );
  }

  const totalWords = dictionary?.size ?? 0;
  // 収録語数はとても多く、割合はいつまでも1%に満たない。がっかりさせないよう
  // 前面に出すのは「あつめた語数」にして、割合は小さな添え字にとどめる。
  const percent = totalWords > 0 ? (collected.length / totalWords) * 100 : 0;
  // 「0.0%」と出ると集めた実感まで削いでしまうので、意味のある桁になるまでは出さない
  const percentLabel = percent >= 0.1 ? `(${percent < 10 ? percent.toFixed(1) : Math.round(percent)}%)` : '';
  const totalHeight = filtered.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 4);
  const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + 8;
  const endIndex = Math.min(filtered.length, startIndex + visibleCount);
  const visibleRows = filtered.slice(startIndex, endIndex);

  return (
    <div className="screen screen--decorated">
      <DecoChips chars={['ず', 'か', 'ん', 'こ', 'と', 'ば']} />

      <ChipTitle text="ずかん" caption="つくったことばが たまっていきます" />

      {collectionError && <p className="form-error">ずかんの読み込みに失敗しました: {collectionError}</p>}

      {!collectionError && !collection && <ChipLoader text="ずかんを ひらいています..." />}

      {collection && (
        <>
          <div className="panel panel--text collection-summary">
            <p className="collection-total">
              <span className="collection-total-value">{collected.length}</span>語 あつめた
            </p>
            <div className="collection-progress" aria-hidden="true">
              <span className="collection-progress-fill" style={{ width: `max(4px, ${percent}%)` }} />
            </div>
            <p className="collection-stats">
              <span>
                ぜんぶで {totalWords > 0 ? totalWords.toLocaleString() : '?'}語{percentLabel}
              </span>
              <span className="collection-rare-count">レア {rareCount}語</span>
            </p>
          </div>

          <div className="tab-row">
            <button
              className={`tab-button ${lengthFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => setLengthFilter('all')}
            >
              すべて
            </button>
            {[2, 3, 4, 5, 6, 7, 8].map((len) => (
              <button
                key={len}
                className={`tab-button ${lengthFilter === len ? 'is-active' : ''}`}
                onClick={() => setLengthFilter(len)}
              >
                {len}文字
              </button>
            ))}
          </div>

          <div className="collection-tools">
            <p className="count-badge">{filtered.length}件</p>
            <button
              className={`tab-button tab-button--rare ${rareOnly ? 'is-active' : ''}`}
              aria-pressed={rareOnly}
              onClick={() => setRareOnly((v) => !v)}
            >
              ✨ レアだけ
            </button>
          </div>

          <div className="virtual-list" ref={containerRef} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
            <div style={{ height: totalHeight, position: 'relative' }}>
              {visibleRows.map((w, i) => (
                <div
                  key={w.kana}
                  className={`collection-row ${w.rare ? 'collection-row--rare' : ''}`}
                  style={{
                    position: 'absolute',
                    top: (startIndex + i) * ROW_HEIGHT,
                    left: 0,
                    right: 0,
                    height: ROW_HEIGHT - 6,
                  }}
                >
                  <WordChips word={w.kana} />
                  {w.display !== w.kana && <span className="collection-display">{w.display}</span>}
                  {w.rare && <span className="tier-tag tier-tag--rare">レア</span>}
                  <span className="collection-date">{formatFoundAt(w.foundAt)}</span>
                </div>
              ))}
            </div>
            {filtered.length === 0 && (
              <EmptyChip
                mark="ず"
                text={
                  collected.length === 0
                    ? 'まだ ことばが ありません。ゲームで単語をつくると ここにたまります'
                    : 'この条件に あてはまる ことばは ありません'
                }
              />
            )}
          </div>
        </>
      )}

      <button className="button button--ghost button--block" onClick={() => navigate('/')}>
        タイトルへもどる
      </button>
    </div>
  );
}
