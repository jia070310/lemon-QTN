import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import {
  DEFAULT_COMPANY_SETTINGS,
  type CompanySettings,
} from '../lib/company';

export function SettingsPage() {
  const [form, setForm] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getCompanySettings()
      .then(({ item }) => setForm({ ...DEFAULT_COMPANY_SETTINGS, ...item }))
      .catch((e) => setError(e.message));
  }, []);

  function patch<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onPickQr(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }
    if (file.size > 4.5 * 1024 * 1024) {
      setError('图片请小于 4.5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      patch('qrImage', result);
      setMsg('已选择收款码图片，请点击保存');
    };
    reader.readAsDataURL(file);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMsg('');
    try {
      const { item } = await api.saveCompanySettings(form);
      setForm({ ...DEFAULT_COMPANY_SETTINGS, ...item });
      setMsg('公司设置已保存，新建预览将使用最新信息');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <p className="muted page-desc">设置报价单页眉电话、页脚银行账号与收款码（全员共用）</p>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="ok">{msg}</div>}

      <form className="panel" onSubmit={submit}>
        <h3>页眉联系电话</h3>
        <div className="grid-form">
          <label>
            显示名称
            <input
              value={form.phoneLabel}
              onChange={(e) => patch('phoneLabel', e.target.value)}
            />
          </label>
          <label>
            电话
            <input value={form.phone} onChange={(e) => patch('phone', e.target.value)} />
          </label>
        </div>

        <h3 className="settings-section-title">银行信息</h3>
        <div className="grid-form">
          <label>
            银行名称
            <input
              value={form.bankName}
              onChange={(e) => patch('bankName', e.target.value)}
              placeholder="华侨银行"
            />
          </label>
          <label>
            收款公司名
            <input
              value={form.bankCompany}
              onChange={(e) => patch('bankCompany', e.target.value)}
              placeholder="JINCHAN TRADING SDN BHD"
            />
          </label>
          <label>
            马币账号
            <input
              value={form.accountMyr}
              onChange={(e) => patch('accountMyr', e.target.value)}
            />
          </label>
          <label>
            多币种账号
            <input
              value={form.accountFx}
              onChange={(e) => patch('accountFx', e.target.value)}
            />
          </label>
          <label className="span-2">
            多币种说明
            <input
              value={form.accountFxNote}
              onChange={(e) => patch('accountFxNote', e.target.value)}
              placeholder="（美金、人民币、澳元、新币、欧元）"
            />
          </label>
        </div>

        <h3 className="settings-section-title">收款码</h3>
        <div className="grid-form">
          <label className="span-2">
            收款码说明文字
            <input
              value={form.qrLabel}
              onChange={(e) => patch('qrLabel', e.target.value)}
              placeholder="TNG收款码（ZHANG HUAJUN）"
            />
          </label>
          <label className="span-2">
            上传收款码图片
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onPickQr(e.target.files?.[0] || null)}
            />
          </label>
        </div>
        {form.qrImage ? (
          <div className="qr-preview-box">
            <img src={form.qrImage} alt={form.qrLabel || '收款码'} />
            <button
              type="button"
              className="link danger"
              onClick={() => patch('qrImage', '')}
            >
              清除图片
            </button>
          </div>
        ) : (
          <p className="hint">未上传时，打印页会显示「请上传收款码」占位</p>
        )}

        <div className="row" style={{ marginTop: '1rem' }}>
          <button type="submit" disabled={saving}>
            {saving ? '保存中…' : '保存设置'}
          </button>
        </div>
      </form>

      <div className="panel">
        <h3>页脚固定文案（不可改）</h3>
        <p className="muted">请核对确认此订单的所有内容，确认无误后，我们尽快安排检验生产制作！</p>
        <p className="muted">安装完成后付清全部尾款</p>
      </div>
    </div>
  );
}
