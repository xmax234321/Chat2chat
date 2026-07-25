import { registerPlugin } from '@capacitor/core';

export interface DocumentPreviewPlugin {
  preview(options: { path: string }): Promise<void>;
}

export const DocumentPreview = registerPlugin<DocumentPreviewPlugin>('DocumentPreview');
