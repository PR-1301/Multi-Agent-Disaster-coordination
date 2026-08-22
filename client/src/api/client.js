import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Mock Auth Token interceptor as requested
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token') || 'mock_token_123';
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
    config.headers['x-admin-token'] = 'admin-secret-123'; // Hardcoded for this demo since the backend expects it
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // We could trigger a global auth revoked state here,
      // but for now we'll throw it to be handled by the component.
      console.error('ACCESS REVOKED — RE-AUTHENTICATE');
      window.dispatchEvent(new CustomEvent('auth-error'));
    }
    return Promise.reject(error);
  }
);

export default apiClient;
