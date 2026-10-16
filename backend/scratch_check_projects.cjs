// Temporary diagnostic script - safe to delete
require('dotenv').config({ path: __dirname + '/.env', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

(async () => {
  const { data, error } = await supabase.from('projects').select('id,name,code,created_by,organization_id,created_at').eq('code', 'ZZDIAG');
  console.log('ZZDIAG rows:', error, data);
  const { data: pu } = await supabase.from('project_users').select('*').in('project_id', (data || []).map(d => d.id));
  console.log('project_users:', pu);
})();
