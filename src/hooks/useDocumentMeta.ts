import { useEffect } from 'react';

const DEFAULT_TITLE = 'もじふる | ひらがなを集めて単語をつくるブラウザゲーム';
const DEFAULT_DESCRIPTION =
  'もじふるは、上から降ってくるひらがなをタップして集め、制限時間内に単語を作ってスコアを競う無料のブラウザゲームです。インストール不要・登録不要ですぐに遊べます。';

/**
 * SPAのためルート遷移だけでは<title>/meta descriptionが変わらない。
 * クローラーがJSを実行して読む前提(Googlebot)で、検索結果に出る内容をページごとに変える。
 * アンマウント時に既定値へ戻すのは、Reactの厳密でないマウント順(StrictMode二重実行等)に振り回されないため。
 */
export function useDocumentMeta(title: string, description: string): void {
  useEffect(() => {
    const fullTitle = `${title} | もじふる`;
    document.title = fullTitle;
    const meta = document.querySelector('meta[name="description"]');
    meta?.setAttribute('content', description);

    return () => {
      document.title = DEFAULT_TITLE;
      meta?.setAttribute('content', DEFAULT_DESCRIPTION);
    };
  }, [title, description]);
}
