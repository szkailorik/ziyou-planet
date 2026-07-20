import type { IdiomExhibit, IdiomVisualSymbol } from './data/idiom-exhibits';

function Symbol({ kind, x, y, color }: { kind: IdiomVisualSymbol; x: number; y: number; color: string }) {
  const common = { stroke: color, strokeWidth: 5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  if (kind === 'sun') return <g><circle cx={x} cy={y} r="17" fill="#ffd56a" stroke={color} strokeWidth="4" /><path d={`M${x} ${y - 27}v-8M${x} ${y + 27}v8M${x - 27} ${y}h-8M${x + 27} ${y}h8`} {...common} /></g>;
  if (kind === 'mountain') return <path d={`M${x - 33} ${y + 24}l25-43 15 22 12-18 29 39z`} fill="#b7d8b0" stroke={color} strokeWidth="4" strokeLinejoin="round" />;
  if (kind === 'water') return <g {...common}><path d={`M${x - 34} ${y - 10}q13-11 26 0t26 0t26 0`} /><path d={`M${x - 34} ${y + 7}q13-11 26 0t26 0t26 0`} /><path d={`M${x - 34} ${y + 24}q13-11 26 0t26 0t26 0`} /></g>;
  if (kind === 'flower') return <g><circle cx={x} cy={y} r="9" fill="#ffd56a" /><g fill="#f49b9b" stroke={color} strokeWidth="3"><circle cx={x} cy={y - 17} r="11" /><circle cx={x + 16} cy={y - 4} r="11" /><circle cx={x + 10} cy={y + 15} r="11" /><circle cx={x - 10} cy={y + 15} r="11" /><circle cx={x - 16} cy={y - 4} r="11" /></g></g>;
  if (kind === 'tree') return <g><path d={`M${x} ${y + 28}v-34`} {...common} /><circle cx={x} cy={y - 14} r="28" fill="#a8d5ae" stroke={color} strokeWidth="4" /></g>;
  if (kind === 'snow') return <path d={`M${x - 28} ${y}h56M${x} ${y - 28}v56M${x - 20} ${y - 20}l40 40M${x + 20} ${y - 20}l-40 40`} {...common} />;
  if (kind === 'wind') return <g {...common}><path d={`M${x - 34} ${y - 14}h48q15 0 15-10q0-8-9-8`} /><path d={`M${x - 38} ${y + 2}h67q12 0 12 10q0 10-12 10`} /><path d={`M${x - 25} ${y + 20}h24`} /></g>;
  if (kind === 'fire') return <path d={`M${x} ${y + 31}c-26-3-31-27-14-43c2 13 10 12 13-8c22 18 34 41 18 58c-4 4-10 7-17 7z`} fill="#ff9b65" stroke={color} strokeWidth="4" />;
  if (kind === 'rabbit') return <g fill="#fff7ed" stroke={color} strokeWidth="4"><ellipse cx={x - 10} cy={y - 27} rx="8" ry="20" transform={`rotate(-12 ${x - 10} ${y - 27})`} /><ellipse cx={x + 11} cy={y - 27} rx="8" ry="20" transform={`rotate(12 ${x + 11} ${y - 27})`} /><circle cx={x} cy={y + 5} r="27" /><circle cx={x - 9} cy={y} r="2" fill={color} /><circle cx={x + 9} cy={y} r="2" fill={color} /></g>;
  if (kind === 'tiger') return <g><circle cx={x} cy={y} r="31" fill="#f3b55f" stroke={color} strokeWidth="4" /><path d={`M${x - 15} ${y - 18}l6 10M${x} ${y - 23}v12M${x + 15} ${y - 18}l-6 10M${x - 12} ${y + 12}q12 10 24 0`} {...common} /></g>;
  if (kind === 'fox') return <g><path d={`M${x - 31} ${y - 20}l20 6L${x} ${y - 30}l11 16 20-6-7 31q-24 24-48 0z`} fill="#e99362" stroke={color} strokeWidth="4" /><circle cx={x - 10} cy={y} r="2" fill={color} /><circle cx={x + 10} cy={y} r="2" fill={color} /></g>;
  if (kind === 'horse' || kind === 'cow') return <g><path d={`M${x - 29} ${y + 17}q0-37 25-37h21q15 0 15 14v23z`} fill={kind === 'horse' ? '#c98962' : '#f3e5c9'} stroke={color} strokeWidth="4" /><path d={`M${x - 19} ${y + 17}v17M${x + 20} ${y + 17}v17M${x + 30} ${y - 6}l12-9`} {...common} /></g>;
  if (kind === 'bird') return <path d={`M${x - 34} ${y + 10}q18-30 34-5q16-25 34 5q-18-13-34 14q-16-27-34-14z`} fill="#a8cfe0" stroke={color} strokeWidth="4" />;
  if (kind === 'fish') return <g><ellipse cx={x - 4} cy={y} rx="29" ry="20" fill="#8ccbd0" stroke={color} strokeWidth="4" /><path d={`M${x + 24} ${y}l22-17v34z`} fill="#8ccbd0" stroke={color} strokeWidth="4" /><circle cx={x - 16} cy={y - 4} r="3" fill={color} /></g>;
  if (kind === 'frog') return <g><circle cx={x} cy={y + 5} r="27" fill="#92cc88" stroke={color} strokeWidth="4" /><circle cx={x - 14} cy={y - 18} r="9" fill="#dff0d9" stroke={color} strokeWidth="4" /><circle cx={x + 14} cy={y - 18} r="9" fill="#dff0d9" stroke={color} strokeWidth="4" /></g>;
  if (kind === 'snake' || kind === 'dragon') return <path d={`M${x - 34} ${y - 19}c44-24 50 15 16 17c-29 2-29 31 8 31c15 0 24-7 28-16`} {...common} strokeWidth={kind === 'dragon' ? 8 : 6} />;
  if (kind === 'book') return <g><path d={`M${x} ${y - 22}q-20-13-37-4v43q19-8 37 5zM${x} ${y - 22}q20-13 37-4v43q-19-8-37 5z`} fill="#fff4cb" stroke={color} strokeWidth="4" /></g>;
  if (kind === 'speech') return <path d={`M${x - 35} ${y - 23}h70v42h-37l-14 13 3-13h-22z`} fill="#e8dcfa" stroke={color} strokeWidth="4" strokeLinejoin="round" />;
  if (kind === 'heart') return <path d={`M${x} ${y + 28}c-42-25-38-58-14-58q14 0 14 15q0-15 14-15q24 0 14 27q-5 15-28 31z`} fill="#ef9a9a" stroke={color} strokeWidth="4" />;
  if (kind === 'people') return <g fill="#f0c7a5" stroke={color} strokeWidth="4"><circle cx={x - 17} cy={y - 13} r="12" /><circle cx={x + 17} cy={y - 13} r="12" /><path d={`M${x - 35} ${y + 29}q4-28 18-28q14 0 17 28M${x} ${y + 29}q4-28 17-28q14 0 18 28`} /></g>;
  if (kind === 'hand') return <path d={`M${x - 22} ${y + 28}v-32q0-8 7-8q6 0 6 8v-19q0-7 7-7q7 0 7 7v17q1-7 7-7q7 0 7 7v8q2-6 8-4q6 2 4 10l-8 29q-3 11-16 11z`} fill="#f2c7a1" stroke={color} strokeWidth="4" />;
  if (kind === 'clock') return <g><circle cx={x} cy={y} r="30" fill="#f4e8c9" stroke={color} strokeWidth="4" /><path d={`M${x} ${y - 16}v18l14 9`} {...common} /></g>;
  if (kind === 'boat') return <g><path d={`M${x - 37} ${y + 5}h74l-13 23h-48z`} fill="#c88d61" stroke={color} strokeWidth="4" /><path d={`M${x} ${y + 5}v-37l24 21H${x}`} fill="#fff3d7" stroke={color} strokeWidth="4" /></g>;
  if (kind === 'road') return <path d={`M${x - 25} ${y + 32}q35-28 0-62M${x + 25} ${y + 32}q-22-29 0-62`} {...common} strokeWidth="7" />;
  return <path d={`M${x} ${y - 30}l9 20 23 2-17 15 5 23-20-12-20 12 5-23-17-15 23-2z`} fill="#ffd56a" stroke={color} strokeWidth="4" />;
}

export default function IdiomThumbnail({ idiom, large = false }: { idiom: IdiomExhibit; large?: boolean }) {
  const hue = (idiom.text.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) * 17) % 360;
  const positions = idiom.visualSymbols.length === 1 ? [120] : idiom.visualSymbols.length === 2 ? [82, 158] : [54, 120, 186];
  return <svg className={large ? 'idiom-thumbnail idiom-thumbnail--large' : 'idiom-thumbnail'} viewBox="0 0 240 150" role="img" aria-label={`${idiom.text}的小图：${idiom.visualBasis}`}>
    <rect width="240" height="150" rx="22" fill={`hsl(${hue} 55% 93%)`} />
    <circle cx="212" cy="24" r="39" fill={`hsl(${hue} 52% 86%)`} opacity=".72" />
    <path d="M0 126q45-20 88 0t87 0t65 0v24H0z" fill={`hsl(${(hue + 58) % 360} 45% 82%)`} />
    {idiom.visualSymbols.map((symbol, index) => <Symbol key={`${symbol}-${index}`} kind={symbol} x={positions[index]} y={80 + (index % 2 ? 5 : -4)} color="#51455a" />)}
    <g><rect x="12" y="11" width="28" height="28" rx="8" fill="#fffaf0" opacity=".9" /><text x="26" y="32" textAnchor="middle" fill="#6f4a3e" fontFamily="KaiTi, STKaiti, serif" fontSize="20">{idiom.text[0]}</text></g>
  </svg>;
}

