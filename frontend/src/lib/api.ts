import Cookies from 'js-cookie';

const API_BASE_URL = 'http://localhost:3001/api';

interface FetchOptions extends RequestInit {
  data?: any;
}

export const fetchApi = async (endpoint: string, options: FetchOptions = {}) => {
  const token = Cookies.get('token');
  const tenantId = Cookies.get('tenant_id');

  // Auto-redirect to login if tenant_id or token is missing
  // (except for auth endpoints which don't need them)
  const isAuthEndpoint = endpoint.startsWith('/auth/') || endpoint.startsWith('/tenants');
  if (!isAuthEndpoint && (!tenantId || !token)) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Session expired. Please log in again.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  if (options.data) {
    config.body = JSON.stringify(options.data);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    // If backend says unauthorized or tenant missing, redirect to login
    if (response.status === 401 || data.error?.includes('tenant')) {
      Cookies.remove('token');
      Cookies.remove('tenant_id');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    throw new Error(data.error || 'API request failed');
  }

  return data;
};
