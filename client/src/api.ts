import type {
  Customer,
  DictCategory,
  DictOption,
  Product,
  Quote,
  QuoteSummary,
  User,
} from './types';

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
  importProducts(
    items: Array<Partial<Product> & { code: string }>,
    updateExisting = true,
  ) {
    return request<{ created: number; updated: number; skipped: number }>('/products/import', {
      method: 'POST',
      body: JSON.stringify({ items, updateExisting }),
    });
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
  duplicateQuote(id: number) {
    return request<{ item: Quote }>(`/quotes/${id}/duplicate`, { method: 'POST' });
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
  listCustomers(q = '', all = false) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (all) params.set('all', '1');
    const qs = params.toString();
    return request<{ items: Customer[] }>(`/customers${qs ? `?${qs}` : ''}`);
  },
  createCustomer(body: Partial<Customer> & { name: string }) {
    return request<{ item: Customer }>('/customers', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateCustomer(id: number, body: Partial<Customer> & { name: string }) {
    return request<{ item: Customer }>(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },
  deleteCustomer(id: number) {
    return request<{ ok: boolean }>(`/customers/${id}`, { method: 'DELETE' });
  },
  listUsers() {
    return request<{ items: User[] }>('/users');
  },
  createUser(body: {
    username: string;
    password: string;
    displayName: string;
    role: 'admin' | 'user';
  }) {
    return request<{ item: User }>('/users', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateUser(
    id: number,
    body: { displayName: string; role: 'admin' | 'user'; password?: string },
  ) {
    return request<{ item: User }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },
  deleteUser(id: number) {
    return request<{ ok: boolean }>(`/users/${id}`, { method: 'DELETE' });
  },
};
