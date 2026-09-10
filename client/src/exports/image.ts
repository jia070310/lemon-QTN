import { domToPng } from 'modern-screenshot';
import type { Quote } from '../types';

/** Independent image export — does not call print/table */
export async function exportImage(element: HTMLElement, quote: Quote) {
  const dataUrl = await domToPng(element, {
    scale: 2,
    backgroundColor: '#ffffff',
  });
  const base = `${quote.customerName || '报价单'}-${quote.quoteDate}`.replace(/[\\/:*?"<>|]/g, '_');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${base}.png`;
  a.click();
}
