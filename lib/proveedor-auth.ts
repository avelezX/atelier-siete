import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { atelierTableAdmin } from '@/lib/supabase';

interface ProveedorSession {
  id: string;   // UUID en atelier_proveedores
  nit: string;
}

export async function getProveedorFromRequest(request: NextRequest): Promise<ProveedorSession | null> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll() {}, // read-only en route handlers
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.app_metadata?.role !== 'proveedor') return null;

    const nit = user.app_metadata?.nit;
    if (!nit) return null;

    const { data } = await atelierTableAdmin('proveedores')
      .select('id, nit')
      .eq('nit', nit)
      .eq('activo', true)
      .single();

    if (!data) return null;
    return { id: data.id, nit: data.nit };
  } catch {
    return null;
  }
}
