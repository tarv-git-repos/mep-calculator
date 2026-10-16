import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function run() {
  console.log("Fetching users...");
  const { data: users, error } = await supabase.from('custom_users').select('*');
  if (error) {
    console.error("Error fetching users:", error);
    process.exit(1);
  }

  const now = Date.now();
  let updatedCount = 0;

  for (const user of users) {
    // Only update users who have NO organization_id, are NOT admins, and have NO expiration set
    if (!user.organization_id && user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN' && !user.subscription_expires) {
      const expires = new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();
      console.log(`Setting expiration for ${user.email} to ${expires}`);
      const { error: updateError } = await supabase
        .from('custom_users')
        .update({ subscription_expires: expires })
        .eq('id', user.id);
      
      if (updateError) {
        console.error(`Error updating ${user.email}:`, updateError);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`Successfully updated ${updatedCount} users.`);
}

run();
