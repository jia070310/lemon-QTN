import type { MeasureUnit } from './units';
import { getMeasureLabels } from './units';

export type QuoteLanguage = 'zh' | 'en' | 'both';

export const LANGUAGE_OPTIONS: { value: QuoteLanguage; label: string }[] = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'both', label: '中英双语' },
];

/** 固定选项 / 常见词中英对照（优先本地翻译，少打接口） */
export const VALUE_MAP: Record<string, string> = {
  布: 'Cloth',
  纱: 'Sheer',
  百叶: 'Blinds',
  对开: 'Center open',
  左单开: 'Left single',
  右单开: 'Right single',
  上下拉: 'Up-down',
  顶装双轨: 'Ceiling double track',
  顶装轨道: 'Ceiling track',
  侧装轨道: 'Side track',
  顶装单轨: 'Ceiling single track',
  一楼: '1st Floor',
  二楼: '2nd Floor',
  三楼: '3rd Floor',
  四楼: '4th Floor',
  五楼: '5th Floor',
  客厅: 'Living Room',
  客厅1: 'Living Room 1',
  客厅2: 'Living Room 2',
  主卧: 'Master Bedroom',
  次卧: 'Secondary Bedroom',
  书房: 'Study',
  餐厅: 'Dining Room',
  厨房: 'Kitchen',
  阳台: 'Balcony',
  卫生间: 'Bathroom',
  儿童房: 'Kids Room',
  客房: 'Guest Room',
};

export function localizeValue(text: string, lang: QuoteLanguage): string {
  if (!text) return text;
  if (lang === 'zh' || lang === 'both') return text;
  return VALUE_MAP[text] || text;
}

/** Merge option-library English labels into VALUE_MAP for English preview */
export function mergeOptionValueMap(items: { label: string; labelEn?: string }[]) {
  for (const it of items) {
    if (it.label && it.labelEn) {
      VALUE_MAP[it.label] = it.labelEn;
    }
  }
}

function pick(lang: QuoteLanguage, zh: string, en: string): string {
  if (lang === 'zh') return zh;
  if (lang === 'en') return en;
  return `${zh} ${en}`;
}

export function getQuoteI18n(lang: QuoteLanguage = 'both', measureUnit: MeasureUnit = 'm') {
  const m = getMeasureLabels(measureUnit);

  const th = (zh: string, en: string) => {
    if (lang === 'zh') return { cn: zh, en: '' };
    if (lang === 'en') return { cn: '', en };
    return { cn: zh, en };
  };

  return {
    lang,
    date: pick(lang, '日期', 'Date'),
    address: pick(lang, '地址', 'Address'),
    customer: pick(lang, '客户', 'Customer'),
    contact: pick(lang, '联系方式', 'Contact'),
    includesTitle: pick(lang, '报价包含以下费用', 'Includes'),
    feeMeasure: pick(lang, '测量费用', 'Measurement'),
    feeProduce: pick(lang, '制作费用', 'Production'),
    feeInstall: pick(lang, '安装费用', 'Installation'),
    feeHeat: pick(lang, '高温定型费用', 'Heat setting'),
    feeOther: pick(lang, '其他费用', 'Other'),
    notesTitle: pick(lang, '备注', 'Notes'),
    confirm: pick(lang, '客户确认', 'Customer Confirmation'),
    subtotal: pick(lang, '明细小计', 'Subtotal'),
    total: pick(lang, '总金额', 'Total Amount'),
    depositPrevious: pick(lang, '之前预收订金', 'Previous Deposit'),
    depositCurrent: pick(lang, '本次收定金', 'Deposit This Time'),
    balanceDue: pick(lang, '剩余尾款', 'Balance Due'),
    includesHint: pick(lang, '（请在包含项前打勾 √）', '(please tick √)'),
    customFeeFallback: pick(lang, '自定义费用', 'Custom fee'),
    accountNo: pick(lang, '账号', 'Account No.'),
    bankMyr: 'MYR',
    phonePrefix: 'JINCHAN CURTAIN(金蝉窗帘)',
    defaultTitle:
      lang === 'en'
        ? 'JINCHAN CURTAIN QTN'
        : lang === 'zh'
          ? '金蝉窗帘报价单'
          : 'JINCHAN CURTAIN QTN [金蝉窗帘报价单]',
    defaultNotes:
      lang === 'en'
        ? '1. Dimensions are subject to actual measurement;\n2. Fabric, color and style are subject to customer selection;'
        : '1. 尺寸以实际测量为准；\n2. 面料、颜色、款式以客户选定为准；',
    columns: {
      no: th('序号', 'No.'),
      floor: th('楼层', 'Floor'),
      area: th('区域', 'Area'),
      type: th('类型', 'Type'),
      model: th('型号', 'Model'),
      open: th('窗帘方式', 'Opening'),
      install: th('安装方式', 'Install'),
      width: th(
        m.widthLabel,
        measureUnit === 'ft' ? 'W(ft)' : 'W',
      ),
      height: th(
        m.heightLabel,
        measureUnit === 'ft' ? 'H(ft)' : 'H',
      ),
      areaSize: th(
        m.areaLabel,
        measureUnit === 'ft' ? 'SQFT' : 'SQM',
      ),
      price: th('单价(RM)', 'Price'),
      amount: th('金额(RM)', 'Amount'),
    },
    exportHeaders() {
      const c = this.columns;
      const cell = (x: { cn: string; en: string }) =>
        lang === 'zh' ? x.cn : lang === 'en' ? x.en : `${x.cn}/${x.en}`;
      return [
        cell(c.no),
        cell(c.floor),
        cell(c.area),
        cell(c.type),
        cell(c.model),
        cell(c.open),
        cell(c.install),
        cell(c.width),
        cell(c.height),
        cell(c.areaSize),
        cell(c.price),
        cell(c.amount),
      ];
    },
  };
}

export function ThLabel({ cn, en }: { cn: string; en: string }) {
  if (cn && en) {
    return (
      <>
        <span className="th-cn">{cn}</span>
        <span className="th-en">{en}</span>
      </>
    );
  }
  return <span className={cn ? 'th-cn' : 'th-en'}>{cn || en}</span>;
}
