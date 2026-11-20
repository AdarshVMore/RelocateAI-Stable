// Base URL for the Flask backend.
// In production the backend serves this app, so requests go to the same origin.
export const API_BASE_URL =
  process.env.REACT_APP_API_URL ??
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');
