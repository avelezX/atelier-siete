import { NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

// POST /api/suppliers/merge - Merge duplicate suppliers
// Body: { primary_id: string, merge_ids: string[] }
// Moves all products from merge_ids suppliers to primary_id, then deletes merge_ids
export async function POST(request: Request) {
  try {
    const { primary_id, merge_ids } = await request.json();

    if (!primary_id || !merge_ids?.length) {
      return NextResponse.json(
        { error: 'Se requiere primary_id y merge_ids[]' },
        { status: 400 }
      );
    }

    // Verify primary supplier exists
    const { data: primary, error: primaryError } = await atelierTableAdmin('suppliers')
      .select('id, name')
      .eq('id', primary_id)
      .single();

    if (primaryError || !primary) {
      return NextResponse.json(
        { error: 'Proveedor principal no encontrado' },
        { status: 404 }
      );
    }

    // Get names of suppliers being merged (for logging)
    const { data: merging } = await atelierTableAdmin('suppliers')
      .select('id, name')
      .in('id', merge_ids);

    const mergedNames = (merging || []).map((s: { name: string }) => s.name);

    // Update all products pointing to merged suppliers → point to primary
    let productsUpdated = 0;
    for (const mergeId of merge_ids) {
      const { data: updated, error: updateError } = await atelierTableAdmin('products')
        .update({
          supplier_id: primary_id,
          supplier_name: primary.name,
        })
        .eq('supplier_id', mergeId)
        .select('id');

      if (updateError) throw new Error(`Error actualizando productos: ${updateError.message}`);
      productsUpdated += (updated || []).length;
    }

    // Delete the merged suppliers
    const { error: deleteError } = await atelierTableAdmin('suppliers')
      .delete()
      .in('id', merge_ids);

    if (deleteError) throw new Error(`Error eliminando proveedores: ${deleteError.message}`);

    return NextResponse.json({
      success: true,
      message: `Proveedores fusionados en "${primary.name}"`,
      primary_name: primary.name,
      merged_names: mergedNames,
      products_updated: productsUpdated,
      suppliers_deleted: merge_ids.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
