export type MeasureUnit = 'm' | 'ft';
export type QuoteLanguage = 'zh' | 'en' | 'both';
/** 打印版面：竖版 A4 / 横版 A4 */
export type PageOrientation = 'portrait' | 'landscape';

export const PAGE_ORIENTATION_OPTIONS: { value: PageOrientation; label: string }[] = [
  { value: 'portrait', label: '竖版 (A4)' },
  { value: 'landscape', label: '横版 (A4)' },
];

export type User = {
  id: number;
  username: string;
  displayName: string;
  role: string;
};

export type Product = {
  id: number;
  code: string;
  type: string;
  defaultUnitPrice: number;
  defaultOpenStyle: string;
  defaultInstallMethod: string;
  note: string;
  enabled: boolean;
};

export type Customer = {
  id: number;
  name: string;
  contact: string;
  address: string;
  note: string;
  enabled: boolean;
};

export type QuoteItem = {
  id?: number;
  floor: string;
  area: string;
  type: string;
  model: string;
  openStyle: string;
  installMethod: string;
  width: number;
  height: number;
  sqm: number;
  unitPrice: number;
  amount: number;
};

export type CustomFee = {
  name: string;
  amount: number;
};

export type Quote = {
  id?: number;
  /** 内部名称，用于列表查找，不打印 */
  name: string;
  title: string;
  quoteDate: string;
  customerName: string;
  address: string;
  contact: string;
  measureUnit: MeasureUnit;
  language: QuoteLanguage;
  /** 打印版面方向 */
  pageOrientation: PageOrientation;
  includeMeasure: boolean;
  includeProduce: boolean;
  includeInstall: boolean;
  includeHeat: boolean;
  includeOther: boolean;
  otherFeeNote: string;
  customFeeNotes: string[];
  otherNotes: string;
  customFees: CustomFee[];
  /** 之前预收订金 */
  depositPrevious: number;
  /** 本次收定金 */
  depositCurrent: number;
  totalAmount: number;
  items: QuoteItem[];
};

export type QuoteSummary = {
  id: number;
  name: string;
  title: string;
  quoteDate: string;
  customerName: string;
  contact: string;
  totalAmount: number;
  updatedAt: string;
};

export type DictCategory = 'type' | 'open_style' | 'install_method';

export type DictOption = {
  id: number;
  category: DictCategory;
  label: string;
  labelEn: string;
  enabled: boolean;
  sortOrder: number;
};

export const DICT_CATEGORY_LABELS: Record<DictCategory, string> = {
  type: '类型',
  open_style: '窗帘方式',
  install_method: '安装方式',
};

/** @deprecated 默认兜底；运行时以选项库为准 */
export const TYPE_OPTIONS = ['布', '纱', '百叶'];
export const OPEN_STYLE_OPTIONS = ['对开', '左单开', '右单开', '上下拉', ''];
export const INSTALL_OPTIONS = ['顶装双轨', '顶装轨道', '侧装轨道', '顶装单轨', ''];

export function emptyItem(): QuoteItem {
  return {
    floor: '',
    area: '',
    type: '布',
    model: '',
    openStyle: '对开',
    installMethod: '顶装双轨',
    width: 0,
    height: 0,
    sqm: 0,
    unitPrice: 0,
    amount: 0,
  };
}

export function calcItem(item: QuoteItem): QuoteItem {
  const width = Number(item.width) || 0;
  const height = Number(item.height) || 0;
  const unitPrice = Number(item.unitPrice) || 0;
  const isBlind = item.type.includes('百叶');
  if (isBlind) {
    const sqm =
      width > 0 && height > 0
        ? Math.round(width * height * 100) / 100
        : Math.round((Number(item.sqm) || 0) * 100) / 100;
    const amount = Math.round(sqm * unitPrice * 100) / 100;
    return { ...item, width, height, unitPrice, sqm, amount };
  }
  return {
    ...item,
    width,
    height,
    unitPrice,
    sqm: 0,
    amount: Math.round(width * unitPrice * 100) / 100,
  };
}

export function calcItemsSubtotal(items: QuoteItem[]) {
  return Math.round(items.reduce((s, it) => s + (Number(it.amount) || 0), 0) * 100) / 100;
}

export function calcCustomFeesTotal(fees: CustomFee[] = []) {
  return Math.round(fees.reduce((s, f) => s + (Number(f.amount) || 0), 0) * 100) / 100;
}

export function calcTotal(items: QuoteItem[], customFees: CustomFee[] = []) {
  return Math.round((calcItemsSubtotal(items) + calcCustomFeesTotal(customFees)) * 100) / 100;
}

/** 剩余尾款 = 总金额 - 之前预收 - 本次定金 */
export function calcBalance(
  totalAmount: number,
  depositPrevious = 0,
  depositCurrent = 0,
): number {
  const bal =
    (Number(totalAmount) || 0) - (Number(depositPrevious) || 0) - (Number(depositCurrent) || 0);
  return Math.round(bal * 100) / 100;
}

export function emptyCustomFee(): CustomFee {
  return { name: '', amount: 0 };
}

export function todayDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}年${m}月${day}日`;
}

export function emptyQuote(): Quote {
  return {
    name: '',
    title: 'JINCHAN CURTAIN QTN [金蝉窗帘报价单]',
    quoteDate: todayDateStr(),
    customerName: '',
    address: '',
    contact: '',
    measureUnit: 'm',
    language: 'both',
    pageOrientation: 'portrait',
    includeMeasure: true,
    includeProduce: true,
    includeInstall: true,
    includeHeat: true,
    includeOther: false,
    otherFeeNote: '',
    customFeeNotes: [''],
    otherNotes: '1. 尺寸以实际测量为准；\n2. 面料、颜色、款式以客户选定为准；',
    customFees: [],
    depositPrevious: 0,
    depositCurrent: 0,
    totalAmount: 0,
    items: [emptyItem()],
  };
}
