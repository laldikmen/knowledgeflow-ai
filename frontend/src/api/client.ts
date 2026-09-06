import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://pxk4tismnk.execute-api.eu-central-1.amazonaws.com/prod';

const client = axios.create({
  baseURL: API_BASE_URL,
  // Match the API Lambda's 30s max so slow AI calls (Bedrock extraction/chat)
  // aren't shown as client errors while the backend is still succeeding.
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the JWT token (stored at login) to every request
client.interceptors.request.use((config) => {
  const auth = localStorage.getItem('auth');
  if (auth) {
    try {
      const { token } = JSON.parse(auth);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // ignore malformed auth storage
    }
  }
  return config;
});

client.interceptors.response.use(
  (response) => {
    // Backend wraps every payload as { success, data }. Unwrap to the inner data
    // so call sites can use response.data directly.
    const body = response.data;
    if (
      body &&
      typeof body === 'object' &&
      'success' in body &&
      'data' in body
    ) {
      response.data = body.data;
    }
    return response;
  },
  (error) => {
    // An expired or invalid token means the stored session is stale. Clear it and
    // send the user back to login instead of leaving them on empty pages.
    // (Skip for the login request itself so failed sign-ins show their own error.)
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isLoginRequest = url.includes('/auth/login');

    if (status === 401 && !isLoginRequest) {
      localStorage.removeItem('auth');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;
