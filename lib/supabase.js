const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(`Env vars ausentes: SUPABASE_URL=${supabaseUrl?'ok':'FALTANDO'} SUPABASE_SERVICE_KEY=${supabaseKey?'ok':'FALTANDO'}`);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

module.exports = { supabase };
