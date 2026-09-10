import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api';
import type { User } from '../types';

type Props = {
  onLogin: (user: User) => void;
};

export function LoginPage({ onLogin }: Props) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token, user } = await api.login(username, password);
      setToken(token);
      onLogin(user);
      navigate('/quotes');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-frame">
        <div className="login-frame-bar">
          <div className="titlebar-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span>金蝉窗帘报价 · 登录</span>
        </div>
        <div className="login-frame-body">
          <aside className="login-stage">
            <p className="login-stage-brand">金蝉窗帘</p>
            <p>量尺报价 · 型号共享 · 打印 / 表格 / 出图</p>
            <ul className="login-points">
              <li>桌面客户端版面，适合门店与展厅电脑</li>
              <li>左侧模块切换，右侧全屏工作区</li>
              <li>后续可直接封装 Electron / Tauri</li>
            </ul>
          </aside>
          <form className="login-card" onSubmit={submit}>
            <h1>登录工作台</h1>
            <p className="muted lede">使用账号进入报价客户端</p>
            {error && <div className="error">{error}</div>}
            <label>
              账号
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </label>
            <label>
              密码
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? '登录中…' : '进入工作台'}
            </button>
            <p className="hint">默认账号 admin / admin123</p>
          </form>
        </div>
      </div>
    </div>
  );
}
