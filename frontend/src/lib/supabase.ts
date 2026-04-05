import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gkxmehoarrxzwrhjsezt.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreG1laG9hcnJ4endyaGpzZXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NjU0NzAsImV4cCI6MjA5MDE0MTQ3MH0.XJltkVDzhnUu_la4QgGVAKkXsYW2pkH2_Z7yBXgdbqM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
