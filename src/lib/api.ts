let currentOperatorName = 'Dra. Camila Mendes (Admin)';

export function setCurrentOperator(name: string) {
  currentOperatorName = name;
}

export function getCurrentOperator(): string {
  return currentOperatorName;
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('X-Operator-Name', currentOperatorName);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Erro na requisição (${response.status})`);
  }
  return data as T;
}
