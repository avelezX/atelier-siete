import { NextRequest, NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const group = searchParams.get('group') ?? '';
    const month = searchParams.get('month') ?? '';
    const search = searchParams.get('search') ?? '';

    const PAGE_SIZE = 1000;
    let offset = 0;
    let hasMore = true;
    const documents: any[] = [];

    while (hasMore) {
      let query = atelierTableAdmin('dian_documents')
        .select('id, cufe, number, prefix, document_type, document_group, issue_date, reception_date, issuer_nit, issuer_name, receiver_nit, receiver_name, amount, tax_amount, currency, status, metadata, created_at')
        .order('issue_date', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (group) query = query.eq('document_group', group);

      if (month) {
        const [year, mon] = month.split('-');
        const startDate = `${month}-01`;
        const endDate = new Date(parseInt(year), parseInt(mon), 0).toISOString().split('T')[0];
        query = query.gte('issue_date', startDate).lte('issue_date', endDate);
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
