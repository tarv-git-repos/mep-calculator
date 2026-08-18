import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function clearHwids() {
  console.log("Fetching users...");
  const { data, error } = await supabase.from('custom_users').select('*');
  if (error) {
    console.error("Error fetching users", error);
    return;
  }
  
  for (const user of data) {
    if (user.active_hwid) {
      console.log(`Clearing hwid for ${user.email}`);
      await supabase.from('custom_users').update({ active_hwid: null }).eq('id', user.id);
    }
  }
  console.log("Done clearing hwids.");
}

clearHwids();
