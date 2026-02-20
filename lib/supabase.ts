import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cliente Supabase (schema public)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Cliente admin con service_role key (solo server-side)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
export const supabaseAdmin = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : supabase

// Helper para acceder a tablas con prefijo atelier_
export const atelierTable = (tableName: string) => {
  return (supabase as any).from(`atelier_${tableName}`)
}

// Helper admin (service_role) para sync y operaciones server-side
export const atelierTableAdmin = (tableName: string) => {
  return (supabaseAdmin as any).from(`atelier_${tableName}`)
}
