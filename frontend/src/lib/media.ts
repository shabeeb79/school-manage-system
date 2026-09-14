const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export function apiOrigin() {
  return apiBase.replace(/\/api\/?$/, '');
}

export function mediaUrl(path?: string | null) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${apiOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
}

export const MAX_ASSIGNMENT_MEDIA_BYTES = 2 * 1024 * 1024;
export const MAX_MEDIA_BYTES = MAX_ASSIGNMENT_MEDIA_BYTES;
export const MAX_MESSAGE_PHOTO_BYTES = 1024 * 1024;
