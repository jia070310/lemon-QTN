import { domToPng } from 'modern-screenshot';
import type { Quote } from '../types';

async function waitForImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }),
    ),
  );
}

/** Independent image export — does not call print/table */
export async function exportImage(element: HTMLElement, quote: Quote) {
  await waitForImages(element);
  // 强制出图尺寸与预览一致，避免截图库按原图像素放大二维码导致页脚错位
  const qrImgs = element.querySelectorAll<HTMLImageElement>('img.tng-qr');
  qrImgs.forEach((img) => {
    img.setAttribute('width', '96');
    img.setAttribute('height', '96');
    img.style.width = '96px';
    img.style.height = '96px';
    img.style.maxWidth = '96px';
    img.style.maxHeight = '96px';
    img.style.objectFit = 'contain';
    img.style.border = '0';
    img.style.outline = '0';
    img.style.boxShadow = 'none';
    img.style.background = 'transparent';
  });

  const dataUrl = await domToPng(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    width: element.offsetWidth,
    height: element.offsetHeight,
  });
  const base = `${quote.customerName || '报价单'}-${quote.quoteDate}`.replace(/[\\/:*?"<>|]/g, '_');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${base}.png`;
  a.click();
}
