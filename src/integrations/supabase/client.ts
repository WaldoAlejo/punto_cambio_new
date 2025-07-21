import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kmmkrrlmvijvntnarfmo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttbWtycmxtdmlqdm50bmFyZm1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MDYzNTIsImV4cCI6MjA2NTQ4MjM1Mn0.0Lj7RAlvwCh-xNpST8AEE_OHUNghqrljF5gkCfCvm4c';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);