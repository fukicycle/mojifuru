/**
 * Mozc辞書 → 品詞フィルタ → JMdictクロスチェック → DAWG + 一覧JSON 変換
 *
 * 生成物:
 *   - public/dict.dawg      判定用(DAWG形式, dawgBuilder.ts / dawg.ts 参照)
 *   - public/wordlist.json  一覧表示用フラットJSON配列 {word, kana, length}[]
 *
 * データソース(scripts/fetchDictSources.ts で事前取得, scripts/.cache/):
 *   - Mozc辞書(BSDライセンス): 読み・品詞IDつきの語彙が入った dictionary00〜09.txt と
 *     品詞IDの意味表を持つ id.def。ここから一般名詞・形容詞・動詞(基本形)のみを抽出する。
 *   - JMdict(CC BY-SA, jmdict-simplified 経由): 抽出した語のクロスチェックに使う。
 *     Mozc辞書は「名詞,一般」に固有名詞・ブランド名・キャラクター名なども
 *     数多く含んでいるため、JMdict(固有名詞を含まない一般語彙辞典)に
 *     読みが存在するものだけを採用することでノイズを除去する。
 *
 * 文字数フィルタ: かな読みで2〜8文字(ゲームルールの範囲と一致させる)。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { buildDawg } from './dawgBuilder.js';

const CACHE_DIR = path.resolve(import.meta.dirname, '.cache');
const MOZC_DIR = path.join(CACHE_DIR, 'mozc');
const PUBLIC_DIR = path.resolve(import.meta.dirname, '../public');

const MIN_LEN = 2;
const MAX_LEN = 8;
const KANA_ONLY = new RegExp(`^[ぁ-ゖ]{${MIN_LEN},${MAX_LEN}}$`);

/**
 * Mozc の id.def から、採用したい品詞に該当する品詞IDの集合を作る。
 *   - 名詞,一般                          … 一般名詞
 *   - 形容詞,自立,...,基本形|口語基本形   … 形容詞の言い切りの形(活用前の基本形のみ)
 *   - 動詞,自立,...,基本形                … 動詞の言い切りの形(活用前の基本形のみ)
 * 固有名詞・接尾辞・助動詞・文語形などはここに含めないことで除外する。
 */
function parseAllowedPosIds(idDefText: string): Set<number> {
  const allowed = new Set<number>();
  for (const line of idDefText.split('\n')) {
    if (!line.trim()) continue;
    const spaceIdx = line.indexOf(' ');
    if (spaceIdx < 0) continue;
    const id = Number(line.slice(0, spaceIdx));
    const fields = line.slice(spaceIdx + 1).split(',');
    const [pos1, pos2, , , , conjugationForm] = fields;

    const isGeneralNoun = pos1 === '名詞' && pos2 === '一般';
    const isAdjectiveBase =
      pos1 === '形容詞' && pos2 === '自立' && (conjugationForm === '基本形' || conjugationForm === '口語基本形');
    const isVerbBase = pos1 === '動詞' && pos2 === '自立' && conjugationForm === '基本形';

    if (isGeneralNoun || isAdjectiveBase || isVerbBase) {
      allowed.add(id);
    }
  }
  return allowed;
}

interface JMdictSense {
  partOfSpeech: string[];
}
interface JMdictKanji {
  text: string;
  common: boolean;
}
interface JMdictKana {
  text: string;
  common: boolean;
}
interface JMdictWord {
  kanji: JMdictKanji[];
  kana: JMdictKana[];
  sense: JMdictSense[];
}

// JMdictクロスチェックで「一般名詞・形容詞・動詞」相当とみなす品詞タグ。
// (形容動詞=形容詞的に使われるna形容詞も、実プレイでの語彙の豊かさのため許容する)
const JMDICT_ALLOWED_POS = new Set([
  'n',
  'adj-i',
  'adj-na',
  'v1',
  'v1-s',
  'v5u',
  'v5k',
  'v5g',
  'v5s',
  'v5t',
  'v5n',
  'v5b',
  'v5m',
  'v5r',
  'v5aru',
  'v5k-s',
  'v5r-i',
  'v5u-s',
  'vs',
  'vk',
  'vz',
]);

/** JMdict から、かな読み → 表示用の単語(常用の漢字表記があればそれ、なければ読みそのもの) を作る */
function buildJmdictCrossCheckMap(jmdictJson: string): Map<string, string> {
  const data = JSON.parse(jmdictJson) as { words: JMdictWord[] };
  const map = new Map<string, string>();

  for (const word of data.words) {
    const posSet = new Set<string>();
    for (const sense of word.sense) for (const pos of sense.partOfSpeech) posSet.add(pos);
    let matchesAllowedPos = false;
    for (const pos of posSet) {
      if (JMDICT_ALLOWED_POS.has(pos)) {
        matchesAllowedPos = true;
        break;
      }
    }
    if (!matchesAllowedPos) continue;

    const commonKanji = word.kanji.find((k) => k.common);
    const display = commonKanji?.text ?? word.kanji[0]?.text ?? null;

    for (const kana of word.kana) {
      if (!KANA_ONLY.test(kana.text)) continue;
      if (!map.has(kana.text) || kana.common) {
        map.set(kana.text, display ?? kana.text);
      }
    }
  }
  return map;
}

interface CandidateEntry {
  cost: number;
  display: string;
}

async function main(): Promise<void> {
  console.log('id.def を読み込み中...');
  const idDefText = await readFile(path.join(MOZC_DIR, 'id.def'), 'utf8');
  const allowedPosIds = parseAllowedPosIds(idDefText);
  console.log(`  採用品詞ID数: ${allowedPosIds.size}`);

  console.log('JMdict を読み込み中(クロスチェック用)...');
  const jmdictJson = await readFile(path.join(CACHE_DIR, 'jmdict-eng.json'), 'utf8');
  const jmdictMap = buildJmdictCrossCheckMap(jmdictJson);
  console.log(`  JMdict 読み数(品詞・かなフィルタ後): ${jmdictMap.size}`);

  console.log('Mozc辞書を読み込み・フィルタ中...');
  const candidates = new Map<string, CandidateEntry>();
  for (let i = 0; i <= 9; i++) {
    const text = await readFile(path.join(MOZC_DIR, `dictionary0${i}.txt`), 'utf8');
    for (const line of text.split('\n')) {
      if (!line) continue;
      const cols = line.split('\t');
      if (cols.length < 5) continue;
      const [reading, leftIdStr, , costStr, surface] = cols;

      if (!allowedPosIds.has(Number(leftIdStr))) continue;
      if (!KANA_ONLY.test(reading)) continue;
      const jmdictDisplay = jmdictMap.get(reading);
      if (jmdictDisplay === undefined) continue; // JMdictクロスチェックに存在しないものは除外

      const cost = Number(costStr);
      const existing = candidates.get(reading);
      // 同じ読みが複数エントリで見つかる場合、Mozcのコストが低い(=より一般的な)方を採用
      if (!existing || cost < existing.cost) {
        candidates.set(reading, { cost, display: jmdictDisplay || surface || reading });
      }
    }
  }
  console.log(`  クロスチェック後の単語数: ${candidates.size}`);

  const sortedKana = [...candidates.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  console.log('DAWGを構築中...');
  const dawg = buildDawg(sortedKana);
  console.log(`  状態数: ${dawg.states.length}`);

  console.log('wordlist.json を構築中...');
  const wordlist = sortedKana.map((kana) => ({
    word: candidates.get(kana)!.display,
    kana,
    length: kana.length,
  }));

  await mkdir(PUBLIC_DIR, { recursive: true });
  await writeFile(path.join(PUBLIC_DIR, 'dict.dawg'), JSON.stringify(dawg));
  await writeFile(path.join(PUBLIC_DIR, 'wordlist.json'), JSON.stringify(wordlist));

  const dawgSizeKb = (JSON.stringify(dawg).length / 1024).toFixed(0);
  const wordlistSizeKb = (JSON.stringify(wordlist).length / 1024).toFixed(0);
  console.log(`\n完了: public/dict.dawg (${dawgSizeKb} KB), public/wordlist.json (${wordlistSizeKb} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
