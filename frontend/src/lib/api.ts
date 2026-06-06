import Cookies from 'js-cookie';

export function getBackendUrl() {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

// Keep for backward compatibility (used by students/import, students/export, useChat)
export const BACKEND_URL = getBackendUrl();

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

  const url = getBackendUrl() + '/api' + endpoint;
  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    // ONLY destroy session on actual 401 Unauthorized (expired/invalid token)
    // Do NOT nuke cookies for 400, 403, 404, 500 errors — those are normal API errors
    if (response.status === 401) {
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
