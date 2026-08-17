import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key'

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
