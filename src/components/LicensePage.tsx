import { useNavigate } from 'react-router-dom';

export default function LicensePage() {
  const navigate = useNavigate();

  return (
    <div className="screen">
      <h2>ライセンス表記</h2>
      <div className="license-section" style={{ flex: 1, overflowY: 'auto' }}>
        <p>
          「もじふる」の判定用辞書・単語一覧は、以下のオープンデータをもとに、品詞によるフィルタリングと
          クロスチェックによる絞り込みを行った上で生成しています。生成処理は{' '}
          <code>scripts/fetchDictSources.ts</code> / <code>scripts/buildDict.ts</code> で公開されています。
        </p>

        <h3>Mozc(モック日本語入力)辞書</h3>
        <p>
          Google日本語入力のオープンソース版である Mozc プロジェクトの辞書データ(
          <code>dictionary00.txt〜dictionary09.txt</code>、<code>id.def</code>)を主データとして使用しています。
        </p>
        <ul>
          <li>配布元: https://github.com/google/mozc</li>
          <li>ライセンス: BSD 3-Clause License</li>
          <li>
            改変内容: 品詞ID(id.def)を用いて「一般名詞」「形容詞(基本形)」「動詞(基本形)」に該当する
            エントリのみを抽出し、かな読みが2〜8文字のひらがなのみで構成されるものに限定しています。
          </li>
        </ul>

        <h3>JMdict(日英辞書データ)</h3>
        <p>
          抽出した語のクロスチェック(固有名詞・ブランド名・キャラクター名などの除外)に、JMdict
          (jmdict-simplified による JSON 配布版)を使用しています。
        </p>
        <ul>
          <li>配布元: Electronic Dictionary Research and Development Group (EDRDG) / https://www.edrdg.org/</li>
          <li>JSON配布: https://github.com/scriptin/jmdict-simplified</li>
          <li>ライセンス: Creative Commons Attribution-ShareAlike Licence (V4.0)</li>
          <li>
            改変内容: 品詞タグが名詞・形容詞・動詞に該当し、読みがひらがな2〜8文字のエントリのみを抽出し、
            Mozc辞書の読みが実在の語彙かどうかを確認するためのクロスチェック用データとして利用しています。
          </li>
        </ul>

        <h3>データ形式について</h3>
        <p>
          判定用データは DAWG(Directed Acyclic Word Graph)形式で <code>public/dict.dawg</code> に、
          一覧表示用データはフラットな JSON 配列として <code>public/wordlist.json</code>{' '}
          に、それぞれビルド時に変換して同梱しています。
        </p>

        <h3>本アプリ自体について</h3>
        <p>「もじふる」自体のソースコードのライセンスについては、リポジトリのルートを参照してください。</p>
      </div>
      <button className="button button--ghost button--block" onClick={() => navigate('/')}>
        タイトルへもどる
      </button>
    </div>
  );
}
