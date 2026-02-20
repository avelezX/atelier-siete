import { NextResponse } from 'next/server';
import { atelierTable } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: lastCompleted } = await atelierTable('sync_log')
      .select('*')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1);

    const { data: running } = await atelierTable('sync_log')
      .select('*')
      .eq('status', 'running')
      .limit(1);

    // Get record counts from each table
    const [products, invoices, customers, creditNotes, suppliers] =
      await Promise.all([
        atelierTable('products').select('id', { count: 'exact', head: true }),
        atelierTable('invoices').select('id', { count: 'exact', head: true }),
        atelierTable('customers').select('id', { count: 'exact', head: true }),
        atelierTable('credit_notes').select('id', { count: 'exact', head: true }),
        atelierTable('suppliers').select('id', { count: 'exact', head: true }),
      ]);

    return NextResponse.json({
      lastSync: lastCompleted?.[0] || null,
      currentSync: running?.[0] || null,
      counts: {
        products: products.count || 0,
        invoices: invoices.count || 0,
        customers: customers.count || 0,
        credit_notes: creditNotes.count || 0,
        suppliers: suppliers.count || 0,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { lastSync: null, currentSync: null, counts: {}, error: message },
      { status: 500 }
    );
  }
}
