import type { Quote } from '../types';
import { VALUE_MAP, getQuoteI18n } from './i18n';

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function hasChinese(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

/** 2026年9月9日 → September 9, 2026 */
export function localizeDateToEnglish(dateStr: string): string {
  const s = (dateStr || '').trim();
  if (!s) return s;

  const zh = s.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/);
  if (zh) {
    const y = Number(zh[1]);
    const m = Number(zh[2]);
    const d = Number(zh[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${MONTHS_EN[m - 1]} ${d}, ${y}`;
    }
  }

  if (!hasChinese(s)) return s;

  const loose = s.match(/(\d{4}).*?(\d{1,2}).*?(\d{1,2})/);
  if (loose) {
    const y = Number(loose[1]);
    const m = Number(loose[2]);
    const d = Number(loose[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${MONTHS_EN[m - 1]} ${d}, ${y}`;
    }
  }
  return s;
}

/** September 9, 2026 → 2026年9月9日 */
export function localizeDateToChinese(dateStr: string): string {
  const s = (dateStr || '').trim();
  if (!s) return s;

  const en = s.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (en) {
    const mi = MONTHS_EN.findIndex((m) => m.toLowerCase() === en[1].toLowerCase());
    if (mi >= 0) {
      return `${en[3]}年${mi + 1}月${Number(en[2])}日`;
    }
  }

  if (/^\d{4}年\d{1,2}月\d{1,2}日?$/.test(s)) return s;
  return s;
}

function localTranslate(text: string): string | null {
  const t = text.trim();
  if (!t) return '';
  if (VALUE_MAP[t]) return VALUE_MAP[t];
  let out = t;
  let hit = false;
  const keys = Object.keys(VALUE_MAP).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (out.includes(k)) {
      out = out.split(k).join(VALUE_MAP[k]);
      hit = true;
    }
  }
  if (hit && !hasChinese(out)) return out;
  return null;
}

/** Collect Chinese free-text fields that need API translation */
export function collectTranslatableTexts(quote: Quote): string[] {
  const bag: string[] = [];
  const push = (s: string) => {
    const t = (s || '').trim();
    if (!t || !hasChinese(t)) return;
    if (localTranslate(t) !== null) return;
    bag.push(t);
  };

  push(quote.title);
  push(quote.address);
  push(quote.customerName);
  push(quote.otherNotes);
  push(quote.otherFeeNote);
  for (const n of quote.customFeeNotes || []) push(n);
  for (const f of quote.customFees || []) push(f.name);
  for (const it of quote.items || []) {
    push(it.floor);
    push(it.area);
    push(it.model);
  }
  return [...new Set(bag)];
}

function applyMap(text: string, apiMap: Record<string, string>): string {
  const t = (text || '').trim();
  if (!t) return text;
  const local = localTranslate(t);
  if (local !== null) return local;
  if (apiMap[t]) return apiMap[t];
  return text;
}

/** Apply translations and switch quote to English */
export function applyQuoteTranslation(
  quote: Quote,
  apiMap: Record<string, string>,
): Quote {
  const enI18n = getQuoteI18n('en', quote.measureUnit || 'm');
  return {
    ...quote,
    language: 'en',
    title: applyMap(quote.title, apiMap) || enI18n.defaultTitle,
    quoteDate: localizeDateToEnglish(quote.quoteDate),
    address: applyMap(quote.address, apiMap),
    customerName: applyMap(quote.customerName, apiMap),
    otherNotes: applyMap(quote.otherNotes, apiMap) || enI18n.defaultNotes,
    otherFeeNote: applyMap(quote.otherFeeNote, apiMap),
    customFeeNotes: (quote.customFeeNotes || []).map((n) => applyMap(n, apiMap)),
    customFees: (quote.customFees || []).map((f) => ({
      ...f,
      name: applyMap(f.name, apiMap),
    })),
    items: quote.items.map((it) => ({
      ...it,
      floor: applyMap(it.floor, apiMap),
      area: applyMap(it.area, apiMap),
      model: applyMap(it.model, apiMap),
    })),
  };
}
