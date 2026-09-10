import type { PageOrientation, Quote } from '../types';

/** Independent print module — does not call export table/image */
export function printQuote(orientation: PageOrientation = 'portrait') {
  const id = 'print-page-orientation';
  document.getElementById(id)?.remove();
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `@page { size: A4 ${orientation}; margin: 8mm; }`;
  document.head.appendChild(style);

  const cleanup = () => {
    style.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  // fallback cleanup if afterprint not fired
  window.setTimeout(cleanup, 60_000);
}

export function buildPrintFileName(quote: Quote) {
  const name = quote.customerName || '报价单';
  return `${name}-${quote.quoteDate}`;
}
