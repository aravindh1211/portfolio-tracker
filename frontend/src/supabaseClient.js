import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Replace with your actual Supabase URL and Anon Key
const supabaseUrl = 'https://dczinklbnqymjkagukre.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjemlua2xibnF5bWprYWd1a3JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MTk0MTcsImV4cCI6MjA3MTI5NTQxN30.FPchF06iqmLCfKWFneEtKYgFZoYUsTX_-M9K-l1mSFc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
