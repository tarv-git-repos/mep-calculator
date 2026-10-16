import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function run() {
  const { data: teams, error: tErr } = await supabase.from('teams').select('*, team_members(user_id)');
  console.log("Teams:");
  console.dir(teams, { depth: null });

  const { data: projects, error: pErr } = await supabase.from('projects').select('*, project_users(user_id), project_teams(team_id)');
  console.log("Projects:");
  console.dir(projects, { depth: null });
}

run();
