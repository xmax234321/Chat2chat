import {
  formatLabel,
  resolveFileVisual,
  type FileVisualKind,
} from './file-type-registry';

const SCALE = 4;
const W = 70 * SCALE;
const H = 86 * SCALE;

const MONO = `700 ${8.5 * SCALE}px "JetBrains Mono", ui-monospace, monospace`;
const MONO_SM = `700 ${8 * SCALE}px "JetBrains Mono", ui-monospace, monospace`;
const MONO_XS = `700 ${7 * SCALE}px "JetBrains Mono", ui-monospace, monospace`;
const DISPLAY = `700 ${22 * SCALE}px system-ui, -apple-system, sans-serif`;

function s(n: number): number {
  return n * SCALE;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function linearGradient(
  ctx: CanvasRenderingContext2D,
  angleDeg: number,
  stops: Array<[number, string]>,
): CanvasGradient {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const cx = W / 2;
  const cy = H / 2;
  const len = Math.sqrt(W * W + H * H) / 2;
  const x0 = cx - Math.cos(rad) * len;
  const y0 = cy - Math.sin(rad) * len;
  const x1 = cx + Math.cos(rad) * len;
  const y1 = cy + Math.sin(rad) * len;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [pos, color] of stops) g.addColorStop(pos, color);
  return g;
}

function drawShadowCard(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = s(20);
  ctx.shadowOffsetY = s(8);
  roundRect(ctx, 0, 0, W, H, s(13));
  ctx.fillStyle = '#1D1D22';
  ctx.fill();
  ctx.restore();
}

function drawExtBadge(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  opts: { bg: string; fg: string; font?: string; padX?: number; padY?: number },
): void {
  const font = opts.font ?? MONO;
  ctx.font = font;
  const padX = opts.padX ?? s(6);
  const padY = opts.padY ?? s(2);
  const textW = ctx.measureText(label).width;
  const badgeW = textW + padX * 2;
  const badgeH = s(8.5) + padY * 2;
  roundRect(ctx, x, y, badgeW, badgeH, s(5));
  ctx.fillStyle = opts.bg;
  ctx.fill();
  ctx.fillStyle = opts.fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + padX, y + badgeH / 2);
}

function drawImageTile(ctx: CanvasRenderingContext2D, label: string): void {
  drawShadowCard(ctx);
  roundRect(ctx, 0, 0, W, H, s(13));
  ctx.fillStyle = linearGradient(ctx, 158, [
    [0, '#3E6FA3'],
    [0.52, '#5FA8C9'],
    [1, '#84C79E'],
  ]);
  ctx.fill();

  const sunX = W - s(11) - s(13);
  const sunY = s(11);
  ctx.beginPath();
  ctx.arc(sunX + s(13) / 2, sunY + s(13) / 2, s(13) / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#FFE7A6';
  ctx.shadowColor = 'rgba(255,231,166,0.8)';
  ctx.shadowBlur = s(10);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(s(18), s(54));
  ctx.lineTo(s(32), s(68));
  ctx.lineTo(s(48), s(40));
  ctx.lineTo(W, s(74));
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = 'rgba(15,26,20,0.55)';
  ctx.fill();

  drawExtBadge(ctx, label, s(6), H - s(6) - s(12.5), {
    bg: 'rgba(11,11,12,0.82)',
    fg: '#F4F4F3',
  });
}

function drawVideoTile(ctx: CanvasRenderingContext2D, label: string, duration?: string): void {
  drawShadowCard(ctx);
  roundRect(ctx, 0, 0, W, H, s(13));
  ctx.fillStyle = linearGradient(ctx, 158, [
    [0, '#2C2E3A'],
    [0.6, '#4A3B58'],
    [1, '#6B4A5A'],
  ]);
  ctx.fill();

  const playR = s(26) / 2;
  const playCx = W / 2;
  const playCy = H / 2;
  ctx.beginPath();
  ctx.arc(playCx, playCy, playR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(244,244,243,0.92)';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(playCx - s(3), playCy - s(7));
  ctx.lineTo(playCx + s(8), playCy);
  ctx.lineTo(playCx - s(3), playCy + s(7));
  ctx.closePath();
  ctx.fillStyle = '#161519';
  ctx.fill();

  if (duration) {
    ctx.font = MONO_SM;
    const padX = s(5);
    const padY = s(1.5);
    const textW = ctx.measureText(duration).width;
    const badgeW = textW + padX * 2;
    const badgeH = s(8) + padY * 2;
    roundRect(ctx, W - s(6) - badgeW, s(6), badgeW, badgeH, s(5));
    ctx.fillStyle = 'rgba(11,11,12,0.75)';
    ctx.fill();
    ctx.fillStyle = '#EDEDEB';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(duration, W - s(6) - badgeW + padX, s(6) + badgeH / 2);
  }

  drawExtBadge(ctx, label, s(6), H - s(6) - s(12.5), {
    bg: 'rgba(11,11,12,0.82)',
    fg: '#F4F4F3',
  });
}

function drawAudioTile(ctx: CanvasRenderingContext2D, label: string, duration?: string): void {
  drawShadowCard(ctx);
  roundRect(ctx, 0, 0, W, H, s(13));
  ctx.fillStyle = linearGradient(ctx, 150, [
    [0, '#7A4B8A'],
    [0.6, '#B95C7E'],
    [1, '#E0916A'],
  ]);
  ctx.fill();

  const bars = [9, 18, 13, 22, 11];
  const gap = s(2.5);
  const barW = s(3);
  const totalW = bars.length * barW + (bars.length - 1) * gap;
  let x = (W - totalW) / 2;
  const baseY = H / 2 + s(4);
  for (const h of bars) {
    roundRect(ctx, x, baseY - s(h), barW, s(h), s(2));
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
    x += barW + gap;
  }

  if (duration) {
    ctx.font = MONO_SM;
    const padX = s(5);
    const padY = s(1.5);
    const textW = ctx.measureText(duration).width;
    const badgeW = textW + padX * 2;
    const badgeH = s(8) + padY * 2;
    roundRect(ctx, W - s(6) - badgeW, s(6), badgeW, badgeH, s(5));
    ctx.fillStyle = 'rgba(11,11,12,0.55)';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(duration, W - s(6) - badgeW + padX, s(6) + badgeH / 2);
  }

  drawExtBadge(ctx, label, s(6), H - s(6) - s(12.5), {
    bg: 'rgba(11,11,12,0.82)',
    fg: '#F4F4F3',
  });
}

function drawCodeTile(ctx: CanvasRenderingContext2D, label: string): void {
  drawShadowCard(ctx);
  roundRect(ctx, 0, 0, W, H, s(12));
  ctx.fillStyle = '#1D1D22';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = SCALE;
  ctx.stroke();

  const lines: Array<Array<{ w: number; color: string; indent?: number }>> = [
    [{ w: 14, color: '#C792EA' }, { w: 22, color: '#82AAFF' }],
    [{ w: 10, color: '#C3E88D', indent: 6 }, { w: 26, color: '#546178' }],
    [{ w: 18, color: '#FFCB6B', indent: 6 }, { w: 12, color: '#546178' }],
    [{ w: 20, color: '#546178' }],
  ];

  let y = s(9);
  const lineH = s(3);
  const gap = s(4);
  for (const segments of lines) {
    let x = s(8);
    for (const seg of segments) {
      x = s(8) + s(seg.indent ?? 0);
      roundRect(ctx, x, y, s(seg.w), lineH, s(2));
      ctx.fillStyle = seg.color;
      ctx.fill();
      x += s(seg.w) + s(3);
    }
    y += lineH + gap;
  }

  drawExtBadge(ctx, label, s(6), H - s(6) - s(12.5), {
    bg: 'rgba(130,170,255,0.18)',
    fg: '#9EC1FF',
  });
}

function drawArchiveIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const scale = size / 24;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#D8A24A';
  ctx.lineWidth = 1.7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(21, 8);
  ctx.lineTo(21, 19);
  ctx.arcTo(21, 21, 19, 21, 2);
  ctx.lineTo(5, 21);
  ctx.arcTo(3, 21, 3, 19, 2);
  ctx.lineTo(3, 8);
  ctx.moveTo(2, 3);
  ctx.lineTo(22, 3);
  ctx.lineTo(22, 8);
  ctx.lineTo(2, 8);
  ctx.moveTo(12, 3);
  ctx.lineTo(12, 8);
  ctx.moveTo(11, 12);
  ctx.lineTo(13, 12);
  ctx.moveTo(11, 15);
  ctx.lineTo(13, 15);
  ctx.stroke();
  ctx.restore();
}

function drawArchiveTile(ctx: CanvasRenderingContext2D, label: string): void {
  drawShadowCard(ctx);
  roundRect(ctx, 0, 0, W, H, s(12));
  ctx.fillStyle = '#1D1D22';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = SCALE;
  ctx.stroke();

  drawArchiveIcon(ctx, W / 2, H / 2 - s(6), s(30));

  ctx.font = MONO;
  drawExtBadge(ctx, label, (W - ctx.measureText(label).width - s(12)) / 2, H - s(6) - s(12.5), {
    bg: 'rgba(216,162,74,0.16)',
    fg: '#E3B968',
    font: MONO,
    padX: s(6),
    padY: s(2),
  });
}

function draw3dIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const scale = size / 24;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#4FB0AA';
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(12, 2);
  ctx.lineTo(21, 7);
  ctx.lineTo(21, 17);
  ctx.lineTo(12, 22);
  ctx.lineTo(3, 17);
  ctx.lineTo(3, 7);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12, 2);
  ctx.lineTo(12, 22);
  ctx.moveTo(3, 7);
  ctx.lineTo(12, 12);
  ctx.lineTo(21, 7);
  ctx.stroke();
  ctx.restore();
}

function draw3dTile(ctx: CanvasRenderingContext2D, label: string): void {
  drawShadowCard(ctx);
  roundRect(ctx, 0, 0, W, H, s(12));
  ctx.fillStyle = '#1D1D22';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = SCALE;
  ctx.stroke();

  draw3dIcon(ctx, W / 2, H / 2 - s(6), s(30));

  ctx.font = MONO;
  drawExtBadge(ctx, label, (W - ctx.measureText(label).width - s(12)) / 2, H - s(6) - s(12.5), {
    bg: 'rgba(79,176,170,0.16)',
    fg: '#6FC7C1',
    font: MONO,
    padX: s(6),
    padY: s(2),
  });
}

type DocumentBody = 'lines' | 'slide' | 'grid';

const DOCUMENT_STYLES: Record<
  string,
  { header: string; body: DocumentBody; gridHighlight?: boolean }
> = {
  'document-pdf': { header: '#E5484D', body: 'lines' },
  'document-docx': { header: '#2B579A', body: 'lines' },
  'document-pptx': { header: '#C43E1C', body: 'slide' },
  'document-xlsx': { header: '#217346', body: 'grid', gridHighlight: true },
  'document-odt': { header: '#2A5DB0', body: 'lines' },
  'document-ods': { header: '#1E8E3E', body: 'grid' },
  'document-odp': { header: '#E8A33D', body: 'slide' },
};

function drawDocumentLines(ctx: CanvasRenderingContext2D, widths: number[]): void {
  let y = s(9);
  const lineH = s(3);
  const gap = s(4);
  for (const w of widths) {
    roundRect(ctx, s(8), y, s(w), lineH, s(2));
    ctx.fillStyle = '#e6e6e6';
    ctx.fill();
    y += lineH + gap;
  }
}

function drawDocumentSlide(ctx: CanvasRenderingContext2D): void {
  const slideY = s(11);
  roundRect(ctx, s(8), slideY, W - s(16), s(26), s(3));
  ctx.fillStyle = '#f0ede9';
  ctx.fill();
  ctx.strokeStyle = '#e3ded8';
  ctx.lineWidth = SCALE;
  ctx.stroke();

  roundRect(ctx, s(8), slideY + s(26) + s(6), (W - s(16)) * 0.7, s(3), s(2));
  ctx.fillStyle = '#e6e6e6';
  ctx.fill();
}

function drawDocumentGrid(ctx: CanvasRenderingContext2D, highlight: boolean): void {
  const cols = 3;
  const rows = 4;
  const gap = s(2);
  const cellH = s(7);
  const padX = s(8);
  const padY = s(9);
  const cellW = (W - padX * 2 - gap * (cols - 1)) / cols;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = padX + c * (cellW + gap);
      const y = padY + r * (cellH + gap);
      const highlighted = highlight && r === 1 && c === 1;
      roundRect(ctx, x, y, cellW, cellH, s(1));
      ctx.fillStyle = highlighted ? '#cfe6d6' : '#eef2ef';
      ctx.fill();
    }
  }
}

function drawDocumentTile(ctx: CanvasRenderingContext2D, kind: FileVisualKind, label: string): void {
  const style = DOCUMENT_STYLES[kind];
  if (!style) return;

  drawShadowCard(ctx);
  roundRect(ctx, 0, 0, W, H, s(11));
  ctx.fillStyle = '#fff';
  ctx.fill();

  ctx.fillStyle = style.header;
  ctx.fillRect(0, 0, W, s(20));

  ctx.font = MONO_SM;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, s(6), s(10));

  if (style.body === 'lines') {
    const widths = kind === 'document-pdf' ? [100, 85, 92, 70, 80] : [100, 85, 92, 70];
    drawDocumentLines(ctx, widths.map((p) => (p / 100) * 54));
  } else if (style.body === 'slide') {
    drawDocumentSlide(ctx);
  } else {
    drawDocumentGrid(ctx, style.gridHighlight ?? false);
  }
}

function drawDesignTile(ctx: CanvasRenderingContext2D, kind: FileVisualKind, label: string): void {
  const styles: Record<string, { bg: string; border: string; mark: string; markColor: string; labelColor: string }> = {
    'design-psd': { bg: '#001E36', border: '#0A3D5C', mark: 'Ps', markColor: '#31A8FF', labelColor: '#7CC4FF' },
    'design-ai': { bg: '#2A0F00', border: '#5A2600', mark: 'Ai', markColor: '#FF9A00', labelColor: '#FFC06B' },
    'design-xd': { bg: '#2E0A2E', border: '#57185A', mark: 'Xd', markColor: '#FF61F6', labelColor: '#FF9CF8' },
    'design-sketch': { bg: '#241C00', border: '#4A3B00', mark: '', markColor: '#FDB300', labelColor: '#FFD05C' },
    'design-fig': { bg: '#1B1B1E', border: 'rgba(255,255,255,0.1)', mark: '', markColor: '', labelColor: '#BFA6FF' },
  };
  const style = styles[kind];
  if (!style) return;

  drawShadowCard(ctx);
  roundRect(ctx, 0, 0, W, H, s(12));
  ctx.fillStyle = style.bg;
  ctx.fill();
  ctx.strokeStyle = style.border;
  ctx.lineWidth = SCALE;
  ctx.stroke();

  if (kind === 'design-sketch') {
    ctx.save();
    ctx.translate(W / 2 - s(13), H / 2 - s(20));
    ctx.scale(s(26) / 24, s(26) / 24);
    ctx.fillStyle = '#FDB300';
    ctx.beginPath();
    ctx.moveTo(12, 3);
    ctx.lineTo(3, 8);
    ctx.lineTo(12, 13);
    ctx.lineTo(21, 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(3, 8);
    ctx.lineTo(12, 21);
    ctx.lineTo(21, 8);
    ctx.fill();
    ctx.restore();
  } else if (kind === 'design-fig') {
    const iconScale = s(24) / 38;
    ctx.save();
    ctx.translate(W / 2 - s(12), H / 2 - s(22));
    ctx.scale(iconScale, iconScale);
    const circles: Array<[number, number, number, string]> = [
      [19, 9.5, 9.5, '#F24E1E'],
      [9.5, 9.5, 9.5, '#FF7262'],
      [28.5, 9.5, 9.5, '#A259FF'],
      [28.5, 28.5, 9.5, '#1ABCFE'],
      [9.5, 28.5, 9.5, '#0ACF83'],
    ];
    for (const [cx, cy, r, color] of circles) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.restore();
  } else {
    ctx.font = DISPLAY;
    ctx.fillStyle = style.markColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.mark, W / 2, H / 2 - s(6));
  }

  ctx.font = MONO;
  ctx.fillStyle = style.labelColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, W / 2, H / 2 + s(18));
}

function drawEpubTile(ctx: CanvasRenderingContext2D, label: string): void {
  drawShadowCard(ctx);
  roundRect(ctx, 0, 0, W, H, s(11));
  ctx.fillStyle = linearGradient(ctx, 150, [
    [0, '#5A3E2B'],
    [1, '#8A5A3C'],
  ]);
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, s(6), H);

  const lines = [
    { y: s(14), w: 0.7 },
    { y: s(14) + s(9), w: 0.5 },
  ];
  for (const line of lines) {
    roundRect(ctx, s(14), line.y, (W - s(24)) * line.w, s(4), s(2));
    ctx.fillStyle = line.w > 0.6 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)';
    ctx.fill();
  }

  drawExtBadge(ctx, label, s(6), H - s(6) - s(10), {
    bg: 'rgba(11,11,12,0.75)',
    fg: '#F4F4F3',
    font: MONO_SM,
  });
}

function drawApkTile(ctx: CanvasRenderingContext2D, label: string): void {
  drawShadowCard(ctx);
  roundRect(ctx, 0, 0, W, H, s(12));
  ctx.fillStyle = '#0C1F14';
  ctx.fill();
  ctx.strokeStyle = '#1B3B28';
  ctx.lineWidth = SCALE;
  ctx.stroke();

  const size = s(28);
  ctx.save();
  ctx.translate(W / 2 - size / 2, H / 2 - size / 2 - s(4));
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = '#3DDC84';
  ctx.beginPath();
  ctx.moveTo(6, 9);
  ctx.arcTo(5, 9, 5, 10, 1);
  ctx.lineTo(5, 15);
  ctx.arcTo(5, 16, 6, 16, 1);
  ctx.lineTo(7, 16);
  ctx.lineTo(7, 19);
  ctx.arcTo(7, 20, 8, 20, 1);
  ctx.lineTo(9, 20);
  ctx.arcTo(10, 20, 10, 19, 1);
  ctx.lineTo(10, 16);
  ctx.lineTo(14, 16);
  ctx.lineTo(14, 19);
  ctx.arcTo(14, 20, 15, 20, 1);
  ctx.lineTo(16, 20);
  ctx.arcTo(17, 20, 17, 19, 1);
  ctx.lineTo(17, 16);
  ctx.lineTo(18, 16);
  ctx.arcTo(19, 16, 19, 15, 1);
  ctx.lineTo(19, 10);
  ctx.arcTo(19, 9, 18, 9, 1);
  ctx.lineTo(6, 9);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(9, 5.5, 0.9, 0, Math.PI * 2);
  ctx.arc(15, 5.5, 0.9, 0, Math.PI * 2);
  ctx.fillStyle = '#0C1F14';
  ctx.fill();
  ctx.restore();

  ctx.font = MONO;
  ctx.fillStyle = '#6FE6A6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, W / 2, H / 2 + s(20));
}

function drawIpaTile(ctx: CanvasRenderingContext2D, label: string): void {
  drawShadowCard(ctx);
  roundRect(ctx, 0, 0, W, H, s(12));
  ctx.fillStyle = '#1B1B1E';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = SCALE;
  ctx.stroke();

  const size = s(26);
  ctx.save();
  ctx.translate(W / 2 - size / 2, H / 2 - size / 2 - s(4));
  ctx.scale(size / 24, size / 24);
  const apple = new Path2D(
    'M16.4 12.7c0-2 1.6-3 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7s-1.6-.7-2.6-.7c-1.3 0-2.6.8-3.2 2-1.4 2.4-.4 6 1 8 .6 1 1.4 2 2.4 2s1.3-.6 2.5-.6 1.5.6 2.5.6 1.7-1 2.3-2c.7-1 1-2 1-2s-1.7-.7-1.7-2.6M14.3 5.9c.5-.7.9-1.6.8-2.5-.8 0-1.7.5-2.3 1.2-.5.5-.9 1.5-.8 2.4.9 0 1.7-.5 2.3-1.1',
  );
  ctx.fillStyle = '#F4F4F3';
  ctx.fill(apple);
  ctx.restore();

  ctx.font = MONO;
  ctx.fillStyle = '#C8C8C6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, W / 2, H / 2 + s(20));
}

function drawIcsTile(ctx: CanvasRenderingContext2D, label: string): void {
  drawShadowCard(ctx);
  roundRect(ctx, 0, 0, W, H, s(11));
  ctx.fillStyle = '#fff';
  ctx.fill();

  ctx.fillStyle = '#E5484D';
  ctx.fillRect(0, 0, W, s(20));

  ctx.font = MONO_XS;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const month = new Date().toLocaleString('en-US', { month: 'short' }).toUpperCase();
  ctx.fillText(month, W / 2, s(10));

  ctx.font = `700 ${28 * SCALE}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = '#1A1A1A';
  ctx.fillText(String(new Date().getDate()), W / 2, s(20) + s(22));

  ctx.font = MONO_SM;
  ctx.fillStyle = '#8A867C';
  ctx.fillText(label, W / 2, H - s(8));
}

function drawGenericTile(ctx: CanvasRenderingContext2D, label: string): void {
  drawShadowCard(ctx);
  roundRect(ctx, 0, 0, W, H, s(12));
  ctx.fillStyle = '#222224';
  ctx.fill();

  ctx.font = `500 ${32 * SCALE}px system-ui, sans-serif`;
  ctx.fillStyle = '#9c9c9a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('📎', W / 2, H / 2 - s(8));

  drawExtBadge(ctx, label, s(6), H - s(6) - s(12.5), {
    bg: 'rgba(11,11,12,0.82)',
    fg: '#F4F4F3',
  });
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  kind: FileVisualKind,
  label: string,
  duration?: string,
): void {
  switch (kind) {
    case 'image':
      drawImageTile(ctx, label);
      break;
    case 'video':
      drawVideoTile(ctx, label, duration);
      break;
    case 'audio':
      drawAudioTile(ctx, label, duration);
      break;
    case 'code':
      drawCodeTile(ctx, label);
      break;
    case 'archive':
      drawArchiveTile(ctx, label);
      break;
    case '3d':
      draw3dTile(ctx, label);
      break;
    case 'document-pdf':
    case 'document-docx':
    case 'document-pptx':
    case 'document-xlsx':
    case 'document-odt':
    case 'document-ods':
    case 'document-odp':
      drawDocumentTile(ctx, kind, label);
      break;
    case 'design-psd':
    case 'design-ai':
    case 'design-xd':
    case 'design-sketch':
    case 'design-fig':
      drawDesignTile(ctx, kind, label);
      break;
    case 'other-epub':
      drawEpubTile(ctx, label);
      break;
    case 'other-apk':
      drawApkTile(ctx, label);
      break;
    case 'other-ipa':
      drawIpaTile(ctx, label);
      break;
    case 'other-ics':
      drawIcsTile(ctx, label);
      break;
    default:
      drawGenericTile(ctx, label);
  }
}

function canvasToBlobUrl(canvas: HTMLCanvasElement): string {
  return URL.createObjectURL(
    dataUrlToBlob(canvas.toDataURL('image/png')),
  );
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export type FileTypePreviewOptions = {
  duration?: string;
};

/** Render a file-type icon tile and return a blob URL (280×344 retina). */
export function renderFileTypePreview(
  ext: string,
  options?: FileTypePreviewOptions,
): string {
  if (typeof document === 'undefined') return '';

  const kind = resolveFileVisual(ext);
  const label = formatLabel(ext);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  drawTile(ctx, kind, label, options?.duration);
  return canvasToBlobUrl(canvas);
}
