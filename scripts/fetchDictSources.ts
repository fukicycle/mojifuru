/**
 * 辞書ビルドの元データを scripts/.cache/ にダウンロードする。
 *
 * - Mozc辞書(BSDライセンス, google/mozc): 一般語彙・品詞情報の主データ
 * - JMdict(CC BY-SA, EDRDG / jmdict-simplified): クロスチェック用の語彙データ
 *   (固有名詞を含まないため、Mozc側の品詞分類漏れで紛れ込む固有名詞・
 *   ブランド名・キャラクター名などを除外するフィルタとして使う)
 *
 * このスクリプトはネットワークが必要。scripts/.cache/ は .gitignore 済みで、
 * 一度ダウンロードすれば buildDict.ts は再ダウンロードなしで実行できる。
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const CACHE_DIR = path.resolve(import.meta.dirname, '.cache');
const MOZC_DIR = path.join(CACHE_DIR, 'mozc');

const MOZC_BASE = 'https://raw.githubusercontent.com/google/mozc/master/src/data/dictionary_oss';
const JMDICT_RELEASES_API = 'https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest';

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function downloadText(url: string, destPath: string): Promise<void> {
  if (await exists(destPath)) {
    console.log(`skip (already cached): ${path.relative(CACHE_DIR, destPath)}`);
    return;
  }
  console.log(`downloading: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to download ${url}: ${res.status}`);
  const text = await res.text();
  await writeFile(destPath, text, 'utf8');
  console.log(`  -> saved ${path.relative(CACHE_DIR, destPath)} (${(text.length / 1024).toFixed(0)} KB)`);
}

async function main(): Promise<void> {
  await mkdir(MOZC_DIR, { recursive: true });

  await downloadText(`${MOZC_BASE}/id.def`, path.join(MOZC_DIR, 'id.def'));
  for (let i = 0; i <= 9; i++) {
    const name = `dictionary0${i}.txt`;
    await downloadText(`${MOZC_BASE}/${name}`, path.join(MOZC_DIR, name));
  }

  const jmdictDest = path.join(CACHE_DIR, 'jmdict-eng.json');
  if (await exists(jmdictDest)) {
    console.log('skip (already cached): jmdict-eng.json');
  } else {
    console.log('resolving latest jmdict-simplified release...');
    const releaseRes = await fetch(JMDICT_RELEASES_API);
    if (!releaseRes.ok) throw new Error(`failed to query jmdict-simplified releases: ${releaseRes.status}`);
    const release = (await releaseRes.json()) as { assets: { name: string; browser_download_url: string }[] };
    const asset = release.assets.find((a) => /^jmdict-eng-[\d.+]+\.json\.tgz$/.test(a.name) && !a.name.includes('common'));
    if (!asset) throw new Error('could not find jmdict-eng-*.json.tgz asset in latest release');

    console.log(`downloading: ${asset.browser_download_url}`);
    const res = await fetch(asset.browser_download_url);
    if (!res.ok) throw new Error(`failed to download jmdict archive: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const tgzPath = path.join(CACHE_DIR, 'jmdict-eng.json.tgz');
    await writeFile(tgzPath, buf);

    const { execFileSync } = await import('node:child_process');
    execFileSync('tar', ['xzf', tgzPath, '-C', CACHE_DIR]);
    const { readdir, rename, rm } = await import('node:fs/promises');
    const extracted = (await readdir(CACHE_DIR)).find((f) => /^jmdict-eng-[\d.]+\.json$/.test(f));
    if (!extracted) throw new Error('jmdict archive did not contain expected json file');
    await rename(path.join(CACHE_DIR, extracted), jmdictDest);
    await rm(tgzPath);
    console.log(`  -> saved jmdict-eng.json`);
  }

  console.log('\nすべての辞書ソースデータの準備が完了しました。 npm run build-dict を実行してください。');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
