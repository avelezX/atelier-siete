import { NextRequest, NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const group = searchParams.get('group') ?? '';
    const month = searchParams.get('month') ?? '';
    const year = searchParams.get('year') ?? '';
    const search = searchParams.get('search') ?? '';
    const siigoStatus = searchParams.get('siigoStatus') ?? ''; // 'synced' | 'pending' | 'discarded'
    const docType = searchParams.get('docType') ?? ''; // 'factura' | 'nota_credito'

    const PAGE_SIZE = 1000;
    let offset = 0;
    let hasMore = true;
    const documents: any[] = [];

    while (hasMore) {
      let query = atelierTableAdmin('dian_documents')
        .select('id, cufe, number, prefix, document_type, document_group, issue_date, reception_date, issuer_nit, issuer_name, receiver_nit, receiver_name, amount, tax_amount, currency, status, metadata, created_at, siigo_purchase_id, siigo_synced_at')
        .order('issue_date', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (group) query = query.eq('document_group', group);

      if (docType === 'factura') {
        query = query.ilike('document_type', '%Factura%');
      } else if (docType === 'nota_credito') {
        // Filtra "Nota de crédito electrónica" y variantes — excluye Facturas y Notas Débito
        query = query.ilike('document_type', '%cr_dito%');
      }

      if (siigoStatus === 'synced') {
        query = query.not('siigo_purchase_id', 'is', null).neq('siigo_purchase_id', 'DESCARTADO');
      } else if (siigoStatus === 'pending') {
        query = query.is('siigo_purchase_id', null);
      } else if (siigoStatus === 'discarded') {
        query = query.eq('siigo_purchase_id', 'DESCARTADO');
      }

      if (month) {
        const [y, mon] = month.split('-');
        const startDate = `${month}-01`;
        const endDate = new Date(parseInt(y), parseInt(mon), 0).toISOString().split('T')[0];
        query = query.gte('issue_date', startDate).lte('issue_date', endDate);
      } else if (year) {
        query = query.gte('issue_date', `${year}-01-01`).lte('issue_date', `${year}-12-31`);
      }

      if (search) {
        query = query.or(`issuer_name.ilike.%${search}%,number.ilike.%${search}%,issuer_nit.ilike.%${search}%,receiver_name.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      documents.push(...(data || []));
      hasMore = (data || []).length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }

    return NextResponse.json({
      documents,
      summary: {
        total: documents.length,
        totalAmount: documents.reduce((sum: number, d: any) => sum + (d.amount || 0), 0),
        totalIva: documents.reduce((sum: number, d: any) => sum + (d.tax_amount || 0), 0),
      },
    });
  } catch (e: any) {
    console.error('DIAN GET error:', e);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
