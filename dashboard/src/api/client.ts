import axios, { type AxiosRequestConfig } from 'axios';

/**
 * Direct to the api origin with credentials; CORS is configured there against
 * an explicit trusted-origin allowlist. withCredentials is what carries the
 * better-auth session cookie.
 */
const instance = axios.create({
  baseURL: import.meta.env?.VITE_API_URL ?? 'http://localhost:3320',
  withCredentials: true,
});

export const apiClient = async <T>(config: AxiosRequestConfig): Promise<T> => {
  const { data } = await instance.request<T>(config);

  return data;
};

export default apiClient;
