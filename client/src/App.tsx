import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api';
import type { User } from './types';
import { LoginPage } from './pages/LoginPage';
import { ProductsPage } from './pages/ProductsPage';
import { OptionsPage } from './pages/OptionsPage';
import { QuoteEditorPage } from './pages/QuoteEditorPage';
import { QuoteListPage } from './pages/QuoteListPage';
import { SettingsPage } from './pages/SettingsPage';

const NAV = [
  {
    to: '/quotes',
    label: '报价单',
    hint: '量尺与报价',
    match: (path: string) => path.startsWith('/quotes'),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7 3.5h7.5L19 8v12.5H7z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path d="M14.5 3.5V8H19" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <path d="M9.5 12h7M9.5 15.5h5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/products',
    label: '型号库',
    hint: '布艺档案',
    match: (path: string) => path.startsWith('/products'),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <path d="M4 10h16M9 5v14" fill="none" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    ),
  },
  {
    to: '/options',
    label: '选项库',
    hint: '类型/方式',
    match: (path: string) => path.startsWith('/options'),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M5 7h10M5 12h14M5 17h8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <circle cx="17.5" cy="7" r="1.6" fill="currentColor" />
        <circle cx="10.5" cy="17" r="1.6" fill="currentColor" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: '公司设置',
    hint: '银行/收款码',
    match: (path: string) => path.startsWith('/settings'),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <path
          d="M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.6M17.5 15.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.6M17.5 8.1l1.6-1.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
] as const;

function moduleTitle(pathname: string) {
  if (pathname.startsWith('/quotes/') && pathname !== '/quotes/new') return '编辑报价单';
  if (pathname === '/quotes/new') return '新建报价单';
  if (pathname.startsWith('/quotes')) return '报价单';
  if (pathname.startsWith('/products')) return '型号库';
  if (pathname.startsWith('/options')) return '选项库';
  if (pathname.startsWith('/settings')) return '公司设置';
  return '工作台';
}

function Shell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const title = useMemo(() => moduleTitle(location.pathname), [location.pathname]);

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="titlebar no-print">
        <div className="titlebar-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="titlebar-title">金蝉窗帘 · 报价工作台</div>
        <div className="titlebar-spacer" />
      </div>

      <div className="app-body">
        <aside className="sidebar no-print" aria-label="功能模块">
          <div className="sidebar-brand">
            <div className="brand-mark" aria-hidden="true">
              蝉
            </div>
            {!collapsed && (
              <div className="brand-text">
                <strong>金蝉窗帘</strong>
                <span>报价客户端</span>
              </div>
            )}
          </div>

          <nav className="side-nav">
            <p className="nav-label">{collapsed ? '模块' : '业务模块'}</p>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `side-nav-item${isActive || item.match(location.pathname) ? ' active' : ''}`
                }
                title={item.label}
              >
                <span className="nav-icon">{item.icon}</span>
                {!collapsed && (
                  <span className="nav-copy">
                    <span className="nav-name">{item.label}</span>
                    <span className="nav-hint">{item.hint}</span>
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-foot">
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setCollapsed((v) => !v)}
              title={collapsed ? '展开侧栏' : '收起侧栏'}
            >
              {collapsed ? '»' : '« 收起'}
            </button>
            {!collapsed && (
              <div className="sidebar-user">
                <div>
                  <strong>{user.displayName}</strong>
                  <span>已登录</span>
                </div>
                <button type="button" className="link" onClick={onLogout}>
                  退出
                </button>
              </div>
            )}
          </div>
        </aside>

        <div className="workspace">
          <div className="workspace-chrome no-print">
            <div>
              <span className="chrome-kicker">当前模块</span>
              <h1 className="chrome-title">{title}</h1>
            </div>
          </div>
          <div className="workspace-scroll">
            <Outlet />
          </div>
        </div>
      </div>

      <footer className="statusbar no-print">
        <span>就绪</span>
        <span className="statusbar-sep" />
        <span>{title}</span>
        <span className="statusbar-sep" />
        <span className="statusbar-right">{user.displayName}</span>
      </footer>
    </div>
  );
}

function Protected({ user }: { user: User | null }) {
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setBooting(false);
      return;
    }
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setToken(null))
      .finally(() => setBooting(false));
  }, []);

  function logout() {
    setToken(null);
    setUser(null);
    navigate('/login');
  }

  if (booting) {
    return <div className="boot">正在启动工作台…</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/quotes" replace /> : <LoginPage onLogin={setUser} />}
      />
      <Route element={<Protected user={user} />}>
        <Route element={<Shell user={user!} onLogout={logout} />}>
          <Route path="/" element={<Navigate to="/quotes" replace />} />
          <Route path="/quotes" element={<QuoteListPage />} />
          <Route path="/quotes/:id" element={<QuoteEditorPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/options" element={<OptionsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={user ? '/quotes' : '/login'} replace />} />
    </Routes>
  );
}
