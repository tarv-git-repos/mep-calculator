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
    const hasFeatureHwid = user.features && user.features.active_hwid;

    if (hasFeatureHwid) {
      console.log(`Clearing hwid for ${user.email}`);
      let newFeatures = { ...user.features };
      if (newFeatures.active_hwid) {
         newFeatures.active_hwid = null;
      }
      const { error } = await supabase.from('custom_users').update({ features: newFeatures }).eq('id', user.id);
      if (error) console.error("Error clearing:", error);
    }
  }
  console.log("Done clearing hwids.");
}

clearHwids();
