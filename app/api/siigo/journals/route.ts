import { NextRequest, NextResponse } from 'next/server';
import { createJournal, fetchJournal } from '@/lib/siigo';
import { atelierTableAdmin } from '@/lib/supabase';
import type { SiigoCreateJournalItem, SiigoCreateJournalRequest, SiigoCreateJournalResponse } from '@/types/siigo';

// GET /api/siigo/journals?id=<siigo-id>
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    const data = await fetchJournal(id);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const maxDuration = 120;

// Save journal + items to Supabase so dashboards reflect changes immediately (no full sync needed)
async function saveJournalToSupabase(
  response: SiigoCreateJournalResponse,
  request: SiigoCreateJournalRequest
) {
  if (!response.id) return;

  // Upsert journal header
  const { data: journalRow, error: journalError } = await atelierTableAdmin('journals')
    .upsert(
      {
        siigo_id: response.id,
        document_id: response.document?.id || request.document.id,
        number: response.number || null,
        name: response.name || null,
        date: response.date || request.date,
        observations: response.observations || request.observations || null,
        siigo_metadata: {},
      },
      { onConflict: 'siigo_id' }
    )
    .select('id')
    .single();

  if (journalError || !journalRow) return;

  // Insert journal items from the response (has full product info) or fallback to request items
  const items = response.items || [];
  if (items.length > 0) {
    const itemRows = items.map((item) => ({
      journal_id: journalRow.id,
      account_code: item.account?.code || 'unknown',
      movement: item.account?.movement || 'Debit',
      customer_siigo_id: item.customer?.id || null,
      customer_identification: item.customer?.identification || null,
      product_siigo_id: item.product?.id || null,
      product_code: item.product?.code || null,
      product_name: item.product?.name || null,
      product_quantity: item.product?.quantity || null,
      description: item.description || null,
      value: item.value || 0,
    }));
    await atelierTableAdmin('journal_items').insert(itemRows);
  }
}

interface CreateJournalsBody {
  document_type_id: number;
  date: string;
  cogs_account: string;
  inventory_account: string;
  customer_identification: string;
  products: Array<{
    product_code: string;
    product_name: string;
    estimated_cost: number;
    quantity_sold: number;
  }>;
  observations?: string;
  batch_size?: number;
}

interface BatchResult {
  batch: number;
  product_codes: string[];
  success: boolean;
  journal_name?: string;
  journal_id?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateJournalsBody = await request.json();

    if (!body.document_type_id) throw new Error('document_type_id es requerido');
    if (!body.date) throw new Error('date es requerido');
    if (!body.cogs_account) throw new Error('cogs_account es requerido');
    if (!body.inventory_account) throw new Error('inventory_account es requerido');
    if (!body.customer_identification) throw new Error('customer_identification es requerido');
    if (!body.products?.length) throw new Error('Debe seleccionar al menos un producto');

    const batchSize = body.batch_size || 50;
    const results: BatchResult[] = [];

    for (let i = 0; i < body.products.length; i += batchSize) {
      const batch = body.products.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      const items: SiigoCreateJournalItem[] = [];
      for (const product of batch) {
        const cost = Math.round(product.estimated_cost);
        if (cost <= 0) continue;

        // Debit: COGS (6135xx)
        items.push({
          account: { code: body.cogs_account, movement: 'Debit' },
          customer: { identification: body.customer_identification, branch_office: 0 },
          product: { code: product.product_code, quantity: product.quantity_sold },
          description: `Costo estimado - ${product.product_name}`.substring(0, 200),
          value: cost,
        });

        // Credit: Inventory (1435xx)
        items.push({
          account: { code: body.inventory_account, movement: 'Credit' },
          customer: { identification: body.customer_identification, branch_office: 0 },
          product: { code: product.product_code, quantity: product.quantity_sold },
          description: `Costo estimado - ${product.product_name}`.substring(0, 200),
          value: cost,
        });
      }

      if (items.length === 0) continue;

      const journalRequest: SiigoCreateJournalRequest = {
        document: { id: body.document_type_id },
        date: body.date,
        items,
        observations: (body.observations ||
          `Costo estimado (70%) - Lote ${batchNum} - ${batch.length} productos - Generado por Atelier Siete`
        ).substring(0, 4000),
      };

      try {
        const response = await createJournal(journalRequest);
        results.push({
          batch: batchNum,
          product_codes: batch.map(p => p.product_code),
          success: true,
          journal_name: response.name,
          journal_id: response.id,
        });

        // Save to Supabase so dashboards reflect changes immediately
        try {
          await saveJournalToSupabase(response, journalRequest);
        } catch {
          // Non-critical: journal exists in Siigo, Supabase will catch up on next sync
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        results.push({
          batch: batchNum,
          product_codes: batch.map(p => p.product_code),
          success: false,
          error: errMsg,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      total_batches: results.length,
      success_count: successCount,
      fail_count: failCount,
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
