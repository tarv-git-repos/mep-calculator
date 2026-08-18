import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('custom_users').select('email, active_hwid, features').eq('email', 'kadamvikram0304@gmail.com');
  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));
}
check();
