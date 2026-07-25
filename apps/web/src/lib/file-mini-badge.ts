import { formatLabel, normalizeExtension, resolveFileVisual, type FileVisualKind } from './file-type-registry';

export type MiniBadgeStyle = {
  bg: string;
  fg: string;
  border?: string;
  label: string;
};

const VISUAL_STYLES: Record<FileVisualKind, Omit<MiniBadgeStyle, 'label'>> = {
  image: { bg: '#3E7CB1', fg: '#fff' },
  video: { bg: '#7A5EA6', fg: '#fff' },
  audio: { bg: '#C25E7A', fg: '#fff' },
  archive: { bg: '#B98428', fg: '#fff' },
  '3d': { bg: '#2E8B85', fg: '#fff' },
  code: {
    bg: '#2E3440',
    fg: '#9EC1FF',
    border: '1px solid rgba(130, 170, 255, 0.4)',
  },
  'document-pdf': { bg: '#E5484D', fg: '#fff' },
  'document-docx': { bg: '#2B579A', fg: '#fff' },
  'document-pptx': { bg: '#C43E1C', fg: '#fff' },
  'document-xlsx': { bg: '#217346', fg: '#fff' },
  'document-odt': { bg: '#2A5DB0', fg: '#fff' },
  'document-ods': { bg: '#1E8E3E', fg: '#fff' },
  'document-odp': { bg: '#E8A33D', fg: '#2A1B02' },
  'design-psd': { bg: '#001E36', fg: '#31A8FF' },
  'design-ai': { bg: '#2A0F00', fg: '#FF9A00' },
  'design-xd': { bg: '#2E0A2E', fg: '#FF61F6' },
  'design-sketch': { bg: '#241C00', fg: '#FDB300' },
  'design-fig': { bg: '#1E1E22', fg: '#A259FF' },
  'other-epub': { bg: '#8A5A3C', fg: '#fff' },
  'other-apk': { bg: '#0C5A2E', fg: '#6FE6A6' },
  'other-ipa': { bg: '#2A2A2E', fg: '#F4F4F3' },
  'other-ics': { bg: '#E5484D', fg: '#fff' },
  'other-generic': { bg: '#2A2A2E', fg: '#C8C8C6' },
};

function miniLabel(ext: string): string {
  if (ext === 'sketch') return 'SKB';
  return formatLabel(ext);
}

export function getMiniBadgeStyle(fileName: string): MiniBadgeStyle {
  const ext = normalizeExtension(fileName.split('.').pop() ?? '');
  const label = miniLabel(ext || 'file');
  const visual = resolveFileVisual(ext);
  return { ...VISUAL_STYLES[visual], label };
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
