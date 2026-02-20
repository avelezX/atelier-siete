import { NextRequest, NextResponse } from 'next/server';
import { createJournal, fetchJournal } from '@/lib/siigo';
import type { SiigoCreateJournalItem, SiigoCreateJournalRequest } from '@/types/siigo';

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
