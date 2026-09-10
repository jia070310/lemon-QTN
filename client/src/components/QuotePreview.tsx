import { useEffect, useState } from 'react';
import type { Quote } from '../types';
import { calcBalance, calcItemsSubtotal } from '../types';
import { computeSpans } from '../lib/spans';
import {
  DEFAULT_COMPANY_SETTINGS,
  FOOTER_FIXED,
  mergeCompanySettings,
  type CompanySettings,
} from '../lib/company';
import { api } from '../api';
import { ThLabel, getQuoteI18n, localizeValue, type QuoteLanguage } from '../lib/i18n';

type Props = {
  quote: Quote;
};

function formatNum(n: number) {
  if (!n) return '';
  return Number.isInteger(n) ? String(n) : String(n);
}

function formatMoney(n: number) {
  const v = Number(n) || 0;
  return `RM${v.toFixed(2)}`;
}

/** 备注打成一行展示 */
function notesOneLine(text: string) {
  return (text || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join('    ');
}

export function QuotePreview({ quote }: Props) {
  const lang = (quote.language || 'both') as QuoteLanguage;
  const spans = computeSpans(quote.items);
  const rows = quote.items.length > 0 ? quote.items : [];
  const t = getQuoteI18n(lang, quote.measureUnit || 'm');
  const customFees = (quote.customFees || []).filter((f) => f.name.trim() || f.amount);
  const itemsSubtotal = calcItemsSubtotal(quote.items);
  const total = Number(quote.totalAmount) || 0;
  const depPrev = Number(quote.depositPrevious) || 0;
  const depCur = Number(quote.depositCurrent) || 0;
  const balance = calcBalance(total, depPrev, depCur);
  const c = t.columns;
  const [company, setCompany] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const notesLine = notesOneLine(quote.otherNotes);

  useEffect(() => {
    let alive = true;
    api
      .getCompanySettings()
      .then(({ item }) => {
        if (alive) setCompany(mergeCompanySettings(item));
      })
      .catch(() => {
        if (alive) setCompany(DEFAULT_COMPANY_SETTINGS);
      });
    return () => {
      alive = false;
    };
  }, []);

  const qrSrc = company.qrImage?.trim() || '';

  return (
    <div
      className={`quote-sheet lang-${lang} orient-${quote.pageOrientation === 'landscape' ? 'landscape' : 'portrait'}`}
      id="quote-print-root"
    >
      <div className="quote-header">
        <h1 className="quote-title">{quote.title}</h1>
        <div className="quote-company-phone">
          {company.phoneLabel}: {company.phone}
        </div>
      </div>

      <div className="quote-meta quote-meta--grid">
        <div className="meta-field">
          <span className="meta-label">{t.date}：</span>
          <span className="meta-value">{quote.quoteDate}</span>
        </div>
        <div className="meta-field">
          <span className="meta-label">{t.customer}：</span>
          <span className="meta-value">{quote.customerName || '\u00a0'}</span>
        </div>
        <div className="meta-field">
          <span className="meta-label">{t.address}：</span>
          <span className="meta-value meta-value--grow">{quote.address || '\u00a0'}</span>
        </div>
        <div className="meta-field">
          <span className="meta-label">{t.contact}：</span>
          <span className="meta-value">{quote.contact || '\u00a0'}</span>
        </div>
      </div>

      <table className="quote-table">
        <colgroup>
          <col className="col-no" />
          <col className="col-floor" />
          <col className="col-area" />
          <col className="col-type" />
          <col className="col-model" />
          <col className="col-open" />
          <col className="col-install" />
          <col className="col-w" />
          <col className="col-h" />
          <col className="col-sqm" />
          <col className="col-price" />
          <col className="col-amount" />
        </colgroup>
        <thead>
          <tr>
            <th>
              <ThLabel cn={c.no.cn} en={c.no.en} />
            </th>
            <th>
              <ThLabel cn={c.floor.cn} en={c.floor.en} />
            </th>
            <th>
              <ThLabel cn={c.area.cn} en={c.area.en} />
            </th>
            <th>
              <ThLabel cn={c.type.cn} en={c.type.en} />
            </th>
            <th>
              <ThLabel cn={c.model.cn} en={c.model.en} />
            </th>
            <th>
              <ThLabel cn={c.open.cn} en={c.open.en} />
            </th>
            <th>
              <ThLabel cn={c.install.cn} en={c.install.en} />
            </th>
            <th>
              <ThLabel cn={c.width.cn} en={c.width.en} />
            </th>
            <th>
              <ThLabel cn={c.height.cn} en={c.height.en} />
            </th>
            <th>
              <ThLabel cn={c.areaSize.cn} en={c.areaSize.en} />
            </th>
            <th>
              <ThLabel cn={c.price.cn} en={c.price.en} />
            </th>
            <th>
              <ThLabel cn={c.amount.cn} en={c.amount.en} />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it, i) => {
            const sp = spans[i];
            return (
              <tr key={i}>
                {sp.showNo ? <td rowSpan={sp.noSpan || 1}>{sp.groupNo}</td> : null}
                {sp.showFloor ? <td rowSpan={sp.floorSpan || 1}>{it.floor}</td> : null}
                {sp.showArea ? <td rowSpan={sp.areaSpan || 1}>{it.area}</td> : null}
                <td>{localizeValue(it.type, lang)}</td>
                <td className="td-model">{it.model}</td>
                <td>{localizeValue(it.openStyle, lang)}</td>
                <td>{localizeValue(it.installMethod, lang)}</td>
                <td>{formatNum(it.width)}</td>
                <td>{formatNum(it.height)}</td>
                <td>{formatNum(it.sqm)}</td>
                <td>{formatNum(it.unitPrice)}</td>
                <td className="td-amount">{formatNum(it.amount)}</td>
              </tr>
            );
          })}
          {customFees.length > 0 && (
            <tr className="total-row">
              <td colSpan={11} className="total-label">
                {t.subtotal}
              </td>
              <td className="td-amount">{formatNum(itemsSubtotal)}</td>
            </tr>
          )}
          {customFees.map((fee, i) => (
            <tr key={`fee-${i}`} className="fee-amount-row">
              <td colSpan={11} className="total-label">
                {fee.name || t.customFeeFallback}
              </td>
              <td className="td-amount">{formatNum(fee.amount)}</td>
            </tr>
          ))}
          <tr className="total-row grand-total-row">
            <td colSpan={11} className="total-label">
              {t.total}
            </td>
            <td className="td-amount">{total}</td>
          </tr>
        </tbody>
      </table>

      <div className="payment-row">
        <span className="pay-item">
          {t.depositPrevious}：
          <span className="pay-uline">{formatMoney(depPrev)}</span>
        </span>
        <span className="pay-item">
          {t.depositCurrent}：
          <span className="pay-uline">{formatMoney(depCur)}</span>
        </span>
        <span className="pay-item">
          {t.balanceDue}：
          <span className="pay-uline">{formatMoney(balance)}</span>
        </span>
      </div>

      <div className="fee-block">
        <div className="fee-title">
          {t.includesTitle}
          {t.includesHint}：
        </div>
        <div className="fee-items">
          <label>
            <input type="checkbox" checked={quote.includeMeasure} readOnly />
            <span>{t.feeMeasure}</span>
          </label>
          <label>
            <input type="checkbox" checked={quote.includeProduce} readOnly />
            <span>{t.feeProduce}</span>
          </label>
          <label>
            <input type="checkbox" checked={quote.includeInstall} readOnly />
            <span>{t.feeInstall}</span>
          </label>
          <label>
            <input type="checkbox" checked={quote.includeHeat} readOnly />
            <span>{t.feeHeat}</span>
          </label>
          {(quote.customFeeNotes || [])
            .map((n) => n.trim())
            .filter(Boolean)
            .map((note, i) => (
              <label key={`cnote-${i}`}>
                <input type="checkbox" checked readOnly />
                <span>{note}</span>
              </label>
            ))}
          <label className="fee-other">
            <input type="checkbox" checked={quote.includeOther} readOnly />
            <span>
              {t.feeOther}
              {lang === 'zh' ? '（请注明）' : lang === 'en' ? ' (specify)' : '（请注明）'}
              {quote.otherFeeNote ? `：${quote.otherFeeNote}` : '：___________'}
            </span>
          </label>
        </div>
      </div>

      <div className="notes-block notes-block--inline">
        <span className="notes-title">{t.notesTitle}：</span>
        <span className="notes-line">{notesLine || '\u00a0'}</span>
      </div>

      <div className="quote-footer">
        <div className="footer-qr">
          {qrSrc ? (
            <img
              src={qrSrc}
              alt={company.qrLabel}
              className="tng-qr"
              width={96}
              height={96}
              decoding="sync"
            />
          ) : (
            <div className="tng-qr tng-qr--placeholder" aria-label={company.qrLabel}>
              <span>MALAYSIA</span>
              <span>NATIONAL QR</span>
              <strong>请在公司设置上传</strong>
            </div>
          )}
          <div className="tng-label">{company.qrLabel}</div>
        </div>

        <div className="footer-main">
          <div className="footer-bank">
            <div>
              {company.bankName}：{company.bankCompany}
            </div>
            <div>
              马币账号：{company.accountMyr}
            </div>
            <div>
              多币种账号：{company.accountFx}
              {company.accountFxNote}
            </div>
          </div>
          <div className="footer-fixed">
            <p>{FOOTER_FIXED.confirmOrder}</p>
            <p className="bank-balance-note">{FOOTER_FIXED.payBalance}</p>
          </div>
        </div>

        <div className="footer-sign">
          <span>{t.confirm}：</span>
          <span className="sign-line" />
        </div>
      </div>
    </div>
  );
}
