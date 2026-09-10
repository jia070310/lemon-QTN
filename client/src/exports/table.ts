import * as XLSX from 'xlsx';
import type { Quote } from '../types';
import { calcBalance } from '../types';
import { getQuoteI18n, type QuoteLanguage } from '../lib/i18n';

export type TableExportFormat = 'xlsx' | 'csv';

/** Independent table export — does not call print/image */
export function exportTable(quote: Quote, format: TableExportFormat) {
  const lang = (quote.language || 'both') as QuoteLanguage;
  const t = getQuoteI18n(lang, quote.measureUnit || 'm');
  const header = t.exportHeaders();

  const rows = quote.items.map((it, i) => [
    i + 1,
    it.floor,
    it.area,
    it.type,
    it.model,
    it.openStyle,
    it.installMethod,
    it.width || '',
    it.height || '',
    it.sqm || '',
    it.unitPrice || '',
    it.amount || '',
  ]);

  const itemsSubtotal = quote.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const customFees = (quote.customFees || []).filter((f) => f.name.trim() || f.amount);
  if (customFees.length > 0) {
    rows.push([
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      t.subtotal,
      Math.round(itemsSubtotal * 100) / 100,
    ]);
    for (const fee of customFees) {
      rows.push([
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        fee.name || t.customFeeFallback,
        fee.amount || 0,
      ]);
    }
  }
  rows.push(['', '', '', '', '', '', '', '', '', '', t.total, quote.totalAmount]);

  const balance = calcBalance(
    Number(quote.totalAmount) || 0,
    Number(quote.depositPrevious) || 0,
    Number(quote.depositCurrent) || 0,
  );

  const langLabel = lang === 'zh' ? '中文' : lang === 'en' ? 'English' : '中英双语';
  const meta = [
    [lang === 'en' ? 'Title' : '标题', quote.title],
    [lang === 'en' ? 'Name' : '报价单名称', quote.name || ''],
    [t.date, quote.quoteDate],
    [t.customer, quote.customerName],
    [t.address, quote.address],
    [t.contact, quote.contact],
    [lang === 'en' ? 'Language' : '语言', langLabel],
    [t.depositPrevious, quote.depositPrevious || 0],
    [t.depositCurrent, quote.depositCurrent || 0],
    [t.balanceDue, balance],
    [],
    header,
    ...rows,
  ];

  const sheet = XLSX.utils.aoa_to_sheet(meta);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Quote');

  const base = `${quote.customerName || 'quote'}-${quote.quoteDate}`.replace(/[\\/:*?"<>|]/g, '_');
  if (format === 'csv') {
    XLSX.writeFile(book, `${base}.csv`, { bookType: 'csv' });
  } else {
    XLSX.writeFile(book, `${base}.xlsx`, { bookType: 'xlsx' });
  }
}
