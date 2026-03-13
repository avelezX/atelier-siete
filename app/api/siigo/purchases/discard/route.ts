import { NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * POST /api/siigo/purchases/discard
 * Marca documentos DIAN como DESCARTADO para que no reaparezcan como pendientes.
 * Body: { ids: string[] }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { ids } = body as { ids?: string[] };

    if (!ids || ids.length === 0) {
      return NextResponse.json({ error: 'Se requiere un array de ids' }, { status: 400 });
    }

    const { error } = await (atelierTableAdmin('dian_documents') as any)
      .update({ siigo_purchase_id: 'DESCARTADO', siigo_synced_at: new Date().toISOString() })
      .in('id', ids);

    if (error) throw new Error(error.message);

    return NextResponse.json({ discarded: ids.length });
  } catch (err: any) {
    console.error('[/api/siigo/purchases/discard] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
