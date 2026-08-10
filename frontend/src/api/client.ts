import axios from 'axios';

const API_BASE_URL = 'https://pxk4tismnk.execute-api.eu-central-1.amazonaws.com/prod';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('Unauthorized - redirect to login');
    }
    return Promise.reject(error);
  }
);

export default client;
