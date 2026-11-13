import notifyLine from '@fukicycle/design/icons/line/notify.svg?raw';

/*
 * @fukicycle/design のアイコン。SVGをそのまま埋め込むので、色は CSS の color で変わる。
 * 使うものだけをここで読み込む(全部を読み込むと配信サイズが増えるため)。
 */
const ICONS = {
  notify: notifyLine,
} as const;

export type IconName = keyof typeof ICONS;

export default function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const svg = ICONS[name].replace('<svg ', `<svg aria-hidden="true" focusable="false" `).replace(
    / width="24" height="24"/,
    ` width="${size}" height="${size}"`,
  );
  return <span className="icon" dangerouslySetInnerHTML={{ __html: svg }} />;
}
