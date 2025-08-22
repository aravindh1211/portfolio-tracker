import { supabase } from './supabaseClient';

// This is a helper function to make API calls to our backend.
// It automatically adds the user's authentication token to every request.

const request = async (method, url, body = null) => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'An API error occurred');
  }

  // Handle responses with no content
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  return response.json();
};

export const get = (url) => request('GET', url);
export const post = (url, body) => request('POST', url, body);
export const put = (url, body) => request('PUT', url, body);
export const del = (url) => request('DELETE', url);
