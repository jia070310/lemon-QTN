import type { DictCategory, DictOption, Product, Quote, QuoteSummary, User } from './types';

const TOKEN_KEY = 'jinchan_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data as T;
}

export const api = {
  login(username: string, password: string) {
    return request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  me() {
    return request<{ user: User }>('/auth/me');
  },
  listProducts(q = '', all = false) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (all) params.set('all', '1');
    const qs = params.toString();
    return request<{ items: Product[] }>(`/products${qs ? `?${qs}` : ''}`);
  },
  createProduct(body: Partial<Product> & { code: string }) {
    return request<{ item: Product }>('/products', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateProduct(id: number, body: Partial<Product> & { code: string }) {
    return request<{ item: Product }>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },
  deleteProduct(id: number) {
    return request<{ ok: boolean }>(`/products/${id}`, { method: 'DELETE' });
  },
  listQuotes(q = '') {
    const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    return request<{ items: QuoteSummary[] }>(`/quotes${qs}`);
  },
  getQuote(id: number) {
    return request<{ item: Quote }>(`/quotes/${id}`);
  },
  createQuote(body: Quote) {
    return request<{ item: Quote }>('/quotes', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateQuote(id: number, body: Quote) {
    return request<{ item: Quote }>(`/quotes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },
  deleteQuote(id: number) {
    return request<{ ok: boolean }>(`/quotes/${id}`, { method: 'DELETE' });
  },
  translate(texts: string[]) {
    return request<{ translations: Record<string, string> }>('/translate', {
      method: 'POST',
      body: JSON.stringify({ texts }),
    });
  },
  listOptions(category?: DictCategory, q = '', all = false) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (q) params.set('q', q);
    if (all) params.set('all', '1');
    const qs = params.toString();
    return request<{ items: DictOption[] }>(`/options${qs ? `?${qs}` : ''}`);
  },
  createOption(body: {
    category: DictCategory;
    label: string;
    labelEn?: string;
    enabled?: boolean;
    sortOrder?: number;
  }) {
    return request<{ item: DictOption }>('/options', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateOption(
    id: number,
    body: {
      category: DictCategory;
      label: string;
      labelEn?: string;
      enabled?: boolean;
      sortOrder?: number;
    },
  ) {
    return request<{ item: DictOption }>(`/options/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },
  deleteOption(id: number) {
    return request<{ ok: boolean }>(`/options/${id}`, { method: 'DELETE' });
  },
  getCompanySettings() {
    return request<{ item: import('./lib/company').CompanySettings }>('/settings/company');
  },
  saveCompanySettings(body: import('./lib/company').CompanySettings) {
    return request<{ item: import('./lib/company').CompanySettings }>('/settings/company', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },
};
