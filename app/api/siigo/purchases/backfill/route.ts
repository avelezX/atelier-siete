import { NextResponse } from 'next/server';
import { fetchAllPurchases } from '@/lib/siigo';
import { atelierTableAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

const normalizeNum = (s: string) => String(s ?? '').trim().replace(/^0+/, '') || '0';

/**
 * POST /api/siigo/purchases/backfill
 * Compara todas las compras en Siigo contra los documentos DIAN locales sin siigo_purchase_id.
 * Hace matching por NIT|numero_normalizado y actualiza los que encuentra.
 */
export async function POST() {
  try {
    // 1. Traer todas las compras de Siigo
    const siigoPurchases = await fetchAllPurchases();

    // Construir mapa: "NIT|numero_normalizado" → siigo_id
    const siigoMap = new Map<string, string>();
    for (const p of siigoPurchases) {
      const nit = p.supplier?.identification?.trim() ?? '';
      const num = normalizeNum(p.provider_invoice?.number ?? String(p.number ?? ''));
      if (nit && num) {
        siigoMap.set(`${nit}|${num}`, p.id);
      }
    }

    // 2. Traer documentos DIAN sin siigo_purchase_id
    const { data: pending, error: fetchError } = await (atelierTableAdmin('dian_documents') as any)
      .select('id, issuer_nit, number, prefix')
      .eq('document_group', 'Recibido')
      .is('siigo_purchase_id', null);

    if (fetchError) throw new Error(fetchError.message);
    if (!pending || pending.length === 0) {
      return NextResponse.json({ matched: 0, checked: 0 });
    }

    // 3. Encontrar matches
    const matches: Array<{ id: string; siigo_purchase_id: string }> = [];
    for (const doc of pending) {
      const nit = String(doc.issuer_nit ?? '').trim();
      const num = normalizeNum(doc.number ?? '');
      const siigoId = siigoMap.get(`${nit}|${num}`);
      if (siigoId) {
        matches.push({ id: doc.id, siigo_purchase_id: siigoId });
      }
    }

    if (matches.length === 0) {
      return NextResponse.json({ matched: 0, checked: pending.length });
    }

    // 4. Actualizar en lotes de 50
    const BATCH = 50;
    for (let i = 0; i < matches.length; i += BATCH) {
      const batch = matches.slice(i, i + BATCH);
      await Promise.all(
        batch.map((m) =>
          (atelierTableAdmin('dian_documents') as any)
            .update({ siigo_purchase_id: m.siigo_purchase_id, siigo_synced_at: new Date().toISOString() })
            .eq('id', m.id)
        )
      );
    }

    return NextResponse.json({ matched: matches.length, checked: pending.length });
  } catch (err: any) {
    console.error('[/api/siigo/purchases/backfill] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
