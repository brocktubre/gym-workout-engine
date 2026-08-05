/** Resolves the API root, always including the `/api` path segment. */
export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
  if (!envUrl) return '/api';
  if (envUrl.endsWith('/api')) return envUrl;
  return `${envUrl}/api`;
}
