import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { rankRoundPlayers, type RoundRecord } from '../game/roomStats';
import { PlayerTotalsList, RoundPlayerList } from './roomHistoryParts';

// setupFilesを持たない構成のため、自動クリーンアップは効かない。明示的に後始末する。
afterEach(cleanup);

const players = {
  me: { name: 'わたし', score: 120, words: ['ひまわり'] },
  rival: { name: 'らいばる', score: 200, words: ['あいうえおかき', 'ねこ'] },
  quiet: { name: 'しずか', score: 0 },
};

describe('RoundPlayerList', () => {
  it('得点順に並び、行を開くまで相手のことばは出さない', () => {
    render(<RoundPlayerList players={rankRoundPlayers(players)} selfUid="me" />);

    const names = screen.getAllByText(/わたし|らいばる|しずか/).map((el) => el.textContent);
    expect(names).toEqual(['らいばる', 'わたし', 'しずか']);
    expect(screen.queryByLabelText('あいうえおかき')).toBeNull();
  });

  it('相手の行をタップすると、その人が組み立てたことばと点数が見られる', () => {
    render(<RoundPlayerList players={rankRoundPlayers(players)} selfUid="me" />);

    fireEvent.click(screen.getByText('らいばる'));
    expect(screen.getByLabelText('あいうえおかき')).toBeTruthy();
    expect(screen.getByText('大ボーナス')).toBeTruthy();
    // 開いていない自分の行のことばは出ない
    expect(screen.queryByLabelText('ひまわり')).toBeNull();
  });

  it('何人ぶんでも同時に開いたままにできる', () => {
    render(<RoundPlayerList players={rankRoundPlayers(players)} selfUid="me" />);

    fireEvent.click(screen.getByText('らいばる'));
    fireEvent.click(screen.getByText('わたし'));
    // 先に開いた行は閉じない(ふたりのことばを見くらべられる)
    expect(screen.getByLabelText('あいうえおかき')).toBeTruthy();
    expect(screen.getByLabelText('ひまわり')).toBeTruthy();

    // もう一度タップしたぶんだけが閉じる
    fireEvent.click(screen.getByText('らいばる'));
    expect(screen.queryByLabelText('あいうえおかき')).toBeNull();
    expect(screen.getByLabelText('ひまわり')).toBeTruthy();
  });

  it('「ぜんぶひらく」で全員のことばが開き、もう一度押すと閉じる', () => {
    render(<RoundPlayerList players={rankRoundPlayers(players)} selfUid="me" />);

    fireEvent.click(screen.getByText('ぜんぶひらく'));
    expect(screen.getByLabelText('あいうえおかき')).toBeTruthy();
    expect(screen.getByLabelText('ひまわり')).toBeTruthy();
    expect(screen.getByText('このラウンドはことばができませんでした')).toBeTruthy();

    fireEvent.click(screen.getByText('ぜんぶとじる'));
    expect(screen.queryByLabelText('あいうえおかき')).toBeNull();
    expect(screen.queryByLabelText('ひまわり')).toBeNull();
  });

  it('ひとりしかいないラウンドには「ぜんぶひらく」を出さない', () => {
    render(<RoundPlayerList players={rankRoundPlayers({ me: players.me })} selfUid="me" />);
    expect(screen.queryByText('ぜんぶひらく')).toBeNull();
  });

  it('最初から開いておく指定(結果画面の自分)が効く', () => {
    render(<RoundPlayerList players={rankRoundPlayers(players)} selfUid="me" defaultOpenUid="me" />);
    expect(screen.getByLabelText('ひまわり')).toBeTruthy();
  });

  it('ことばが1つもない人はその旨を出す', () => {
    render(<RoundPlayerList players={rankRoundPlayers(players)} />);
    fireEvent.click(screen.getByText('しずか'));
    expect(screen.getByText('このラウンドはことばができませんでした')).toBeTruthy();
  });
});

describe('PlayerTotalsList', () => {
  const rounds: RoundRecord[] = [
    { id: 'r1', startedAt: 1, players },
    { id: 'r2', startedAt: 2, players: { me: { name: 'わたし', score: 300, words: ['ねこ'] } } },
  ];

  it('通算の勝ち数・合計点を出す', () => {
    render(<PlayerTotalsList rounds={rounds} selfUid="me" />);
    expect(screen.getByText('わたし')).toBeTruthy();
    expect(screen.getAllByText('1勝').length).toBe(2);
    expect(screen.getByText(/合計 420点/)).toBeTruthy();
  });

  it('記録がなければ空状態を出す', () => {
    render(<PlayerTotalsList rounds={[]} />);
    expect(screen.getByText('まだ このルームの きろくは ありません')).toBeTruthy();
  });
});
