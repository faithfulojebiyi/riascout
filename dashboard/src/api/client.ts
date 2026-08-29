import axios, { type AxiosRequestConfig } from 'axios';

/**
 * All requests go to /api on this origin, proxied to the api by the nitro
 * server. Same-origin means the session cookie is not cross-site, which is the
 * whole reason for the proxy — see docs/plans/10.
 */
const instance = axios.create({ baseURL: '/api', withCredentials: true });

export const apiClient = async <T>(config: AxiosRequestConfig): Promise<T> => {
  const { data } = await instance.request<T>(config);

  return data;
};

export default apiClient;
