import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables.")
}

if (typeof window === 'undefined' && typeof globalThis !== 'undefined') {
  if (!globalThis.WebSocket) {
    (globalThis as any).WebSocket = class DummyWebSocket {
      constructor() {}
      addEventListener() {}
      removeEventListener() {}
      send() {}
      close() {}
    };
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
