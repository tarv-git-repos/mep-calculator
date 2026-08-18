import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
  const { data } = await supabase.from('custom_users').select('id, email, features').eq('email', 'kadamvikram0304@gmail.com');
  if (data && data.length > 0) {
    const user = data[0];
    let newFeatures = { ...user.features };
    newFeatures.designation = "Discipline Coordinator";
    const { error } = await supabase.from('custom_users').update({ features: newFeatures }).eq('id', user.id);
    if (error) console.error(error);
    else console.log("Successfully updated designation to Discipline Coordinator for", user.email);
  }
}
check();
