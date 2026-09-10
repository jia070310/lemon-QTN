import * as XLSX from 'xlsx';
import type { Quote } from '../types';
import { calcBalance, calcItemsSubtotal } from '../types';
import { getQuoteI18n, type QuoteLanguage } from '../lib/i18n';

export type TableExportFormat = 'xlsx' | 'csv';

const COL_COUNT = 12;

/** 列宽（字符宽度），保证表头与内容可读 */
const COL_WIDTHS = [
  { wch: 8 }, // 序号
  { wch: 8 }, // 楼层
  { wch: 12 }, // 区域
  { wch: 8 }, // 类型
  { wch: 16 }, // 型号
  { wch: 12 }, // 窗帘方式
  { wch: 14 }, // 安装方式
  { wch: 10 }, // 宽
  { wch: 10 }, // 高
  { wch: 12 }, // 平方
  { wch: 12 }, // 单价
  { wch: 12 }, // 金额
];

function emptyRow(): (string | number)[] {
  return Array(COL_COUNT).fill('');
}

function padRow(cells: (string | number)[]): (string | number)[] {
  const row = emptyRow();
  cells.forEach((v, i) => {
    if (i < COL_COUNT) row[i] = v;
  });
  return row;
}

/** Independent table export — does not call print/image */
export function exportTable(quote: Quote, format: TableExportFormat) {
  const lang = (quote.language || 'both') as QuoteLanguage;
  const t = getQuoteI18n(lang, quote.measureUnit || 'm');
  const header = t.exportHeaders();
  const langLabel = lang === 'zh' ? '中文' : lang === 'en' ? 'English' : '中英双语';
  const itemsSubtotal = calcItemsSubtotal(quote.items);
  const balance = calcBalance(
    Number(quote.totalAmount) || 0,
    Number(quote.depositPrevious) || 0,
    Number(quote.depositCurrent) || 0,
  );

  const aoa: (string | number)[][] = [];
  const merges: XLSX.Range[] = [];

  // —— 抬头 ——
  aoa.push(padRow([quote.title || t.defaultTitle]));
  if (quote.name?.trim()) {
    aoa.push(
      padRow([
        lang === 'en' ? 'Quote name' : '报价单名称',
        quote.name.trim(),
      ]),
    );
  }
  aoa.push(padRow([t.date, quote.quoteDate, '', t.customer, quote.customerName || '']));
  aoa.push(padRow([t.address, quote.address || '', '', t.contact, quote.contact || '']));
  aoa.push(
    padRow([
      lang === 'en' ? 'Language' : '语言',
      langLabel,
      '',
      t.depositPrevious,
      Number(quote.depositPrevious) || 0,
      '',
      t.depositCurrent,
      Number(quote.depositCurrent) || 0,
    ]),
  );
  aoa.push(padRow([t.balanceDue, balance]));
  aoa.push(emptyRow());

  // —— 明细表头 ——
  const headerRowIndex = aoa.length;
  aoa.push(padRow(header));

  // —— 明细行 ——
  const items = quote.items.length ? quote.items : [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    aoa.push(
      padRow([
        i + 1,
        it.floor || '',
        it.area || '',
        it.type || '',
        it.model || '',
        it.openStyle || '',
        it.installMethod || '',
        it.width || '',
        it.height || '',
        it.sqm || '',
        it.unitPrice || '',
        it.amount || '',
      ]),
    );
  }

  const customFees = (quote.customFees || []).filter((f) => f.name.trim() || f.amount);
  if (customFees.length > 0) {
    aoa.push(padRow(['', '', '', '', '', '', '', '', '', '', t.subtotal, Math.round(itemsSubtotal * 100) / 100]));
    for (const fee of customFees) {
      aoa.push(
        padRow([
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
          Number(fee.amount) || 0,
        ]),
      );
    }
  }

  aoa.push(
    padRow([
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
      t.total,
      Number(quote.totalAmount) || 0,
    ]),
  );

  if (quote.otherNotes?.trim()) {
    aoa.push(emptyRow());
    const notesRow = aoa.length;
    aoa.push(padRow([t.notesTitle, notesOneLine(quote.otherNotes)]));
    merges.push({ s: { r: notesRow, c: 1 }, e: { r: notesRow, c: COL_COUNT - 1 } });
  }

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = COL_WIDTHS;

  // 标题行合并，抬头更清晰
  merges.unshift({ s: { r: 0, c: 0 }, e: { r: 0, c: COL_COUNT - 1 } });
  // 地址值横向拉开一点
  const addressRow = quote.name?.trim() ? 3 : 2;
  merges.push({ s: { r: addressRow, c: 1 }, e: { r: addressRow, c: 2 } });
  sheet['!merges'] = merges;

  // 表头行略增高（部分 Excel 会尊重）
  sheet['!rows'] = [];
  sheet['!rows'][0] = { hpt: 22 };
  sheet['!rows'][headerRowIndex] = { hpt: 20 };

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, '报价单');

  const base = `${quote.customerName || 'quote'}-${quote.quoteDate}`.replace(/[\\/:*?"<>|]/g, '_');
  if (format === 'csv') {
    // CSV 不依赖列宽；仍导出完整行列
    XLSX.writeFile(book, `${base}.csv`, { bookType: 'csv' });
  } else {
    XLSX.writeFile(book, `${base}.xlsx`, { bookType: 'xlsx' });
  }
}

function notesOneLine(text: string) {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join('  ');
}
