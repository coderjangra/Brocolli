import type { ReactNode } from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

export type IconName =
  | 'inbox'
  | 'users'
  | 'home'
  | 'user'
  | 'plus'
  | 'settings'
  | 'back'
  | 'close'
  | 'check'
  | 'undo'
  | 'up'
  | 'trash'
  | 'chevron'
  | 'share'
  | 'edit'
  | 'send'
  | 'zap'
  | 'message'
  | 'download'
  | 'info'
  | 'card'
  | 'copy'
  | 'qr'
  | 'file'
  | 'shield';

const L = (x1: number, y1: number, x2: number, y2: number, key?: string) => (
  <Line key={key ?? `${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} />
);

const glyphs: Record<IconName, ReactNode> = {
  inbox: (
    <>
      <Polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <Path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  users: (
    <>
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx={9} cy={7} r={4} />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  home: (
    <>
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Polyline points="9 22 9 12 15 12 15 22" />
    </>
  ),
  user: (
    <>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </>
  ),
  plus: [L(12, 5, 12, 19), L(5, 12, 19, 12)],
  settings: [
    L(4, 21, 4, 14),
    L(4, 10, 4, 3),
    L(12, 21, 12, 12),
    L(12, 8, 12, 3),
    L(20, 21, 20, 16),
    L(20, 12, 20, 3),
    L(1, 14, 7, 14),
    L(9, 8, 15, 8),
    L(17, 16, 23, 16),
  ],
  back: (
    <>
      {L(19, 12, 5, 12)}
      <Polyline points="12 19 5 12 12 5" />
    </>
  ),
  close: [L(18, 6, 6, 18), L(6, 6, 18, 18)],
  check: <Polyline points="20 6 9 17 4 12" />,
  undo: (
    <>
      <Polyline points="1 4 1 10 7 10" />
      <Path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </>
  ),
  up: (
    <>
      {L(12, 19, 12, 5)}
      <Polyline points="5 12 12 5 19 12" />
    </>
  ),
  trash: (
    <>
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  chevron: <Polyline points="9 18 15 12 9 6" />,
  share: (
    <>
      <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <Polyline points="16 6 12 2 8 6" />
      {L(12, 2, 12, 15)}
    </>
  ),
  edit: (
    <>
      <Path d="M12 20h9" />
      <Path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </>
  ),
  send: (
    <>
      {L(22, 2, 11, 13)}
      <Polygon points="22 2 15 22 11 13 2 9 22 2" />
    </>
  ),
  zap: <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  message: <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  download: (
    <>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Polyline points="7 10 12 15 17 10" />
      {L(12, 15, 12, 3)}
    </>
  ),
  info: (
    <>
      <Circle cx={12} cy={12} r={10} />
      {L(12, 16, 12, 12)}
      {L(12, 8, 12.01, 8)}
    </>
  ),
  card: (
    <>
      <Rect x={1} y={4} width={22} height={16} rx={2} ry={2} />
      {L(1, 10, 23, 10)}
    </>
  ),
  copy: (
    <>
      <Rect x={9} y={9} width={13} height={13} rx={2} ry={2} />
      <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  qr: (
    <>
      <Rect x={3} y={3} width={7} height={7} />
      <Rect x={14} y={3} width={7} height={7} />
      <Rect x={3} y={14} width={7} height={7} />
      {L(14, 14, 14, 21, 'q1')}
      {L(14, 14, 21, 14, 'q2')}
      {L(18, 18, 21, 18, 'q3')}
      {L(18, 18, 18, 21, 'q4')}
    </>
  ),
  file: (
    <>
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Polyline points="14 2 14 8 20 8" />
      {L(8, 13, 16, 13)}
      {L(8, 17, 16, 17)}
    </>
  ),
  shield: <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
};

export function Icon({
  name,
  size = 22,
  color,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glyphs[name]}
    </Svg>
  );
}
