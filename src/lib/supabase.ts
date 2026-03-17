import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sfyhropycxkcjzmdtzir.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmeWhyb3B5Y3hrY2p6bWR0emlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NjUxNDYsImV4cCI6MjA4OTM0MTE0Nn0.BM-aW3TpUdsoIwzDtinMJUiZdTxZsg-9HwbrsK_tCKg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
