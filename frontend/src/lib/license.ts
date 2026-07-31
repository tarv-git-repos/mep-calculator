import { supabase } from "@/lib/supabase";

export async function getLicenseWatermark(): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) {
      // In a real app, you would also verify the license validity in a database.
      return `Licensed to: ${session.user.email} | MEP Calculator Pro`;
    }
    return "UNLICENSED / DEMO VERSION";
  } catch (err) {
    return "UNLICENSED / DEMO VERSION";
  }
}
