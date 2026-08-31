import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Creates a Supabase client configured with Clerk Auth JWT token.
 * @param {Function} getClerkToken - Function returning Clerk session token (template: 'supabase')
 */
export const createClerkSupabaseClient = (getClerkToken) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: async (url, options = {}) => {
        const token = getClerkToken ? await getClerkToken({ template: 'supabase' }) : null;
        const headers = new Headers(options.headers);
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        return fetch(url, {
          ...options,
          headers,
        });
      },
    },
  });
};

// Fallback anonymous client for public reads (if any)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
