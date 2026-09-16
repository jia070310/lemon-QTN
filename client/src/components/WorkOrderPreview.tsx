import type { MeasureUnit, Quote, WorkOrderKind, WorkOrderLine } from '../types';
import { WORK_ORDER_LABELS, normalizeItemSource } from '../types';
import { computeSpans } from '../lib/spans';
import { getMeasureLabels } from '../lib/units';

type Props = {
  kind: WorkOrderKind;
  quote: Pick<
    Quote,
    'quoteDate' | 'customerName' | 'address' | 'contact' | 'measureUnit' | 'name' | 'pageOrientation'
  >;
  items: WorkOrderLine[];
  /** 合并多报价时显示来源列 */
  showFromQuote?: boolean;
};

function formatNum(n: number) {
  if (!n) return '';
  return Number.isInteger(n) ? String(n) : String(n);
}

function sourceLabel(it: { source?: unknown; brandName?: string }) {
  const v = normalizeItemSource(it.source);
  if (v === 'brand') {
    const brand = String(it.brandName || '').trim();
    return brand ? `品牌·${brand}` : '品牌';
  }
  return '自有';
}

export function WorkOrderPreview({ kind, quote, items, showFromQuote = false }: Props) {
  const unit = (quote.measureUnit || 'm') as MeasureUnit;
  const labels = getMeasureLabels(unit);
  const spans = computeSpans(items);
  const title = WORK_ORDER_LABELS[kind];
  const orient = quote.pageOrientation === 'landscape' ? 'landscape' : 'portrait';
  const colCount = showFromQuote ? 12 : 11;

  return (
    <div className={`quote-sheet work-order-sheet orient-${orient}`} id="work-order-print-root">
      <div className="quote-header">
        <h1 className="quote-title">{title}</h1>
      </div>

      <div className="quote-meta quote-meta--grid">
        <div className="meta-field">
          <span className="meta-label">日期：</span>
          <span className="meta-value">{quote.quoteDate}</span>
        </div>
        <div className="meta-field">
          <span className="meta-label">客户：</span>
          <span className="meta-value">{quote.customerName || '\u00a0'}</span>
        </div>
        <div className="meta-field">
          <span className="meta-label">地址：</span>
          <span className="meta-value meta-value--grow">{quote.address || '\u00a0'}</span>
        </div>
        <div className="meta-field">
          <span className="meta-label">联系方式：</span>
          <span className="meta-value">{quote.contact || '\u00a0'}</span>
        </div>
        {quote.name?.trim() ? (
          <div className="meta-field span-2">
            <span className="meta-label">作业单：</span>
            <span className="meta-value">{quote.name.trim()}</span>
          </div>
        ) : null}
      </div>

      <table className="quote-table work-order-table">
        <thead>
          <tr>
            <th>序号</th>
            {showFromQuote ? <th>来源</th> : null}
            <th>楼层</th>
            <th>区域</th>
            <th>类型</th>
            <th>型号</th>
            <th>货源</th>
            <th>窗帘方式</th>
            <th>安装方式</th>
            <th>{labels.widthLabel}</th>
            <th>{labels.heightLabel}</th>
            <th>{labels.areaLabel}</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={colCount} style={{ textAlign: 'center', padding: '12px' }}>
                无明细行
              </td>
            </tr>
          ) : (
            items.map((it, index) => {
              const sp = spans[index];
              return (
                <tr key={index}>
                  {sp.showNo ? <td rowSpan={sp.noSpan}>{sp.groupNo}</td> : null}
                  {showFromQuote ? <td>{it.fromQuote || ''}</td> : null}
                  {sp.showFloor ? <td rowSpan={sp.floorSpan}>{it.floor}</td> : null}
                  {sp.showArea ? <td rowSpan={sp.areaSpan}>{it.area}</td> : null}
                  <td>{it.type}</td>
                  <td>{it.model}</td>
                  <td>{sourceLabel(it)}</td>
                  <td>{it.openStyle}</td>
                  <td>{it.installMethod}</td>
                  <td className="num">{formatNum(it.width)}</td>
                  <td className="num">{formatNum(it.height)}</td>
                  <td className="num">{formatNum(it.sqm)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <div className="work-order-footer">
        {kind === 'brand' && <p>本单为品牌报单，请按型号与尺寸备货/出货。</p>}
        {kind === 'fabric' && <p>本单为面料下料单，请按型号与用量备料。</p>}
        {kind === 'factory' && <p>本单为工厂制作单，请按楼层区域、尺寸与安装方式制作。</p>}
      </div>
    </div>
  );
}
