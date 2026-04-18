import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.SUPABASE_URL;
const supabaseKey  = process.env.SUPABASE_SERVICE_KEY; // service_role key (server-side only)

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL e SUPABASE_SERVICE_KEY devem estar definidos nas env vars.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
