import { getFirebaseIdToken } from '@/src/lib/firebase';

let currentOperatorName = 'Dra. Camila Mendes (Admin)';

export function setCurrentOperator(name: string) {
  currentOperatorName = name;
}

export function getCurrentOperator(): string {
  return currentOperatorName;
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const buildHeaders = (token: string | null) => {
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('X-Operator-Name', currentOperatorName);
    return headers;
  };

  let token = await getFirebaseIdToken(false);
  let response = await fetch(url, {
    ...options,
    headers: buildHeaders(token),
  });

  if (response.status === 401) {
    token = await getFirebaseIdToken(true);
    if (token) {
      response = await fetch(url, {
        ...options,
        headers: buildHeaders(token),
      });
    }
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Erro na requisição (${response.status})`);
  }
  return data as T;
}
