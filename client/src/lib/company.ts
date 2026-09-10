/** 打印页脚默认值（可在「公司设置」中覆盖） */
export type CompanySettings = {
  phoneLabel: string;
  phone: string;
  bankName: string;
  bankCompany: string;
  accountMyr: string;
  accountFx: string;
  accountFxNote: string;
  qrLabel: string;
  /** data:image/...;base64,... 或空 */
  qrImage: string;
};

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  phoneLabel: 'JINCHAN CURTAIN(金蝉窗帘)',
  phone: '011-63791268',
  bankName: '华侨银行',
  bankCompany: 'JINCHAN TRADING SDN BHD',
  accountMyr: '787-1159942',
  accountFx: '787-1159950',
  accountFxNote: '（美金、人民币、澳元、新币、欧元）',
  qrLabel: 'TNG收款码（ZHANG HUAJUN）',
  qrImage: '',
};

/** 页脚固定文案（不可改） */
export const FOOTER_FIXED = {
  confirmOrder: '请核对确认此订单的所有内容，确认无误后，我们尽快安排检验生产制作！',
  payBalance: '安装完成后付清全部尾款',
} as const;

export function mergeCompanySettings(raw?: Partial<CompanySettings> | null): CompanySettings {
  return { ...DEFAULT_COMPANY_SETTINGS, ...(raw || {}) };
}
