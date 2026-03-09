import { NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

export const maxDuration = 60;

// Show sample purchases that use Account type with 6135
export async function GET() {
  try {
    // Get purchase items with Account type and 6135
    const { data: accountItems } = await atelierTableAdmin('purchase_items')
      .select('purchase_id, account_code, description, price, quantity, line_total')
      .eq('item_type', 'Account')
      .like('account_code', '6135%')
      .limit(20);

    // Get the purchase IDs to fetch purchase details
    const purchaseIds = [...new Set((accountItems || []).map(i => (i as Record<string, unknown>).purchase_id as string))];

    // Fetch those purchases
    const purchases: Record<string, Record<string, unknown>> = {};
    for (const pid of purchaseIds.slice(0, 10)) {
      const { data } = await atelierTableAdmin('purchases')
        .select('id, number, name, date, supplier_name, supplier_identification, total')
        .eq('id', pid)
        .single();
      if (data) purchases[pid] = data as Record<string, unknown>;
    }

    // Build result with purchase + items
    const result = (accountItems || []).map(item => {
      const pi = item as Record<string, unknown>;
      const purchase = purchases[pi.purchase_id as string];
      return {
        factura: purchase ? {
          numero: purchase.number,
          nombre: purchase.name,
          fecha: purchase.date,
          proveedor: purchase.supplier_name,
          nit: purchase.supplier_identification,
          total_factura: purchase.total,
        } : null,
        linea: {
          cuenta: pi.account_code,
          descripcion: pi.description,
          precio: pi.price,
          cantidad: pi.quantity,
          total_linea: pi.line_total,
        },
      };
    });

    return NextResponse.json({ facturas_con_6135: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
