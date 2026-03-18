import { NextRequest, NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';
import { createSupplier } from '@/lib/siigo';

// GET: lista proveedores de atelier_suppliers (sincronizados desde Siigo)
export async function GET() {
  const { data: suppliers, error } = await atelierTableAdmin('suppliers')
    .select('id, name')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Contar productos por proveedor
  const { data: products } = await atelierTableAdmin('products')
    .select('supplier_id')
    .not('supplier_id', 'is', null);

  const countMap: Record<string, number> = {};
  for (const p of products || []) {
    countMap[p.supplier_id] = (countMap[p.supplier_id] || 0) + 1;
  }

  const enriched = (suppliers || []).map((s: { id: string; name: string }) => ({
    ...s,
    product_count: countMap[s.id] || 0,
  }));

  return NextResponse.json(enriched);
}

// POST: crear nuevo proveedor en Siigo + guardar en atelier_suppliers
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nit, nombre, person_type, id_type_code, direccion, ciudad_code, ciudad_state, telefono, email, nombre_contacto } = body;

  if (!nit?.trim() || !nombre?.trim()) {
    return NextResponse.json({ error: 'NIT y nombre son requeridos' }, { status: 400 });
  }

  // Crear en Siigo
  let siigoResult;
  try {
    siigoResult = await createSupplier({
      nit, nombre,
      person_type: person_type || 'Company',
      id_type_code: id_type_code || '31',
      direccion, ciudad_code, ciudad_state, telefono, email, nombre_contacto,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Error en Siigo: ${msg}` }, { status: 500 });
  }

  // Guardar/actualizar en atelier_suppliers
  const { data, error } = await atelierTableAdmin('suppliers')
    .upsert({ name: nombre.trim() }, { onConflict: 'name', ignoreDuplicates: true })
    .select('id, name')
    .single();

  if (error) {
    // No es crítico si falla el upsert local, el de Siigo ya se hizo
    return NextResponse.json({ ok: true, siigo: siigoResult, local: null });
  }

  return NextResponse.json({ ok: true, siigo: siigoResult, local: data }, { status: 201 });
}
