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
    let errorMessage = 'An API error occurred';
    
    try {
      const errorData = await response.json();
      
      // Handle different error response formats
      if (errorData.detail) {
        if (Array.isArray(errorData.detail)) {
          // FastAPI validation errors come as an array
          errorMessage = errorData.detail.map(err => 
            `${err.loc ? err.loc.join('.') + ': ' : ''}${err.msg}`
          ).join(', ');
        } else if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else {
          errorMessage = JSON.stringify(errorData.detail);
        }
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else {
        errorMessage = JSON.stringify(errorData);
      }
    } catch (parseError) {
      // If we can't parse the response, use status text
      errorMessage = `${response.status}: ${response.statusText}`;
    }

    throw new Error(errorMessage);
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
