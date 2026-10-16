import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
  const { data } = await supabase.from('custom_users').select('email, role, features');
  
  for (const user of data) {
    const activeProfile = {
      role: user.role,
      designation: user.features?.designation || user.designation || ''
    };
    const des = (activeProfile.designation || activeProfile.role || "").toLowerCase();
    const roleVal = activeProfile.role;
    
    let userRole = "Jr. / Design Engineer";
    if (des.includes("coordinator") || des.includes("lead")) {
      userRole = "Discipline Coordinator";
    } else if (des.includes("senior") || des.includes("sr") || roleVal === "Sr. Design Engineer") {
      userRole = "Sr. Design Engineer";
    }
    
    console.log(`Email: ${user.email} | Designation: ${activeProfile.designation} | Role: ${activeProfile.role} => Resolved: ${userRole}`);
  }
}
check();
