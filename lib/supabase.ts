import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy initialization to avoid build errors when env vars aren't available
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase env vars not configured');
    _supabase = createClient(url, key);
  }
  return _supabase;
}

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url) throw new Error('Supabase URL not configured');
    _supabaseAdmin = createClient(url, serviceKey || anonKey || '');
  }
  return _supabaseAdmin;
}

// Cliente Supabase (schema public)
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as any)[prop];
  },
});

// Cliente admin con service_role key (solo server-side)
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabaseAdmin() as any)[prop];
  },
});

// Helper para acceder a tablas con prefijo atelier_
export const atelierTable = (tableName: string) => {
  return getSupabase().from(`atelier_${tableName}`) as any;
}

// Helper admin (service_role) para sync y operaciones server-side
export const atelierTableAdmin = (tableName: string) => {
  return getSupabaseAdmin().from(`atelier_${tableName}`) as any;
}
