/**
 * 単語一覧(public/wordlist.json)のfetch + JSON.parseをメインスレッド外で行うワーカー。
 *
 * wordlist.jsonは語数が多く、メインスレッドでfetch後にJSON.parseすると、
 * 一覧画面に遷移した直後に一瞬フリーズしたように見えてしまう(操作を受け付けていないように
 * 感じさせてしまう)ため、この重い処理だけワーカーへ逃がす。
 */
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<string>) => void) | null;
  postMessage: (msg: { ok: true; data: unknown } | { ok: false; error: string }) => void;
};

ctx.onmessage = (e) => {
  const url = e.data;
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.text();
    })
    .then((text) => {
      ctx.postMessage({ ok: true, data: JSON.parse(text) });
    })
    .catch((err: unknown) => {
      ctx.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
    });
};
