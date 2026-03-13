import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, atelierTableAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  // Paginate through all transactions to get accurate period counts
  const periodCounts: Record<string, number> = {};
  const PAGE_SIZE = 1000;
  let offset = 0;

  while (true) {
    const { data } = await atelierTableAdmin('transactions')
      .select('period')
      .range(offset, offset + PAGE_SIZE - 1);

    if (!data || data.length === 0) break;
    for (const row of data) {
      periodCounts[row.period] = (periodCounts[row.period] || 0) + 1;
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (Object.keys(periodCounts).length === 0) return NextResponse.json({ entries: [] });

  // List files from storage
  const { data: folders } = await supabaseAdmin.storage
    .from('atelier-docs')
    .list('extractos', { limit: 100 });

  const filesByPeriod: Record<string, { name: string; created_at: string | null }> = {};

  if (folders) {
    for (const folder of folders) {
      const { data: files } = await supabaseAdmin.storage
        .from('atelier-docs')
        .list(`extractos/${folder.name}`, { limit: 10 });

      if (files && files.length > 0) {
        filesByPeriod[folder.name] = {
          name: files[0].name,
          created_at: files[0].created_at ?? null,
        };
      }
    }
  }

  const entries = Object.keys(periodCounts).map(period => ({
    period,
    count: periodCounts[period],
    file: filesByPeriod[period] ?? null,
  }));

  entries.sort((a, b) => b.period.localeCompare(a.period));

  return NextResponse.json({ entries });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period');

  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: 'Periodo inválido' }, { status: 400 });
  }

  const [yearStr, monthStr] = period.split('-');
  const startDate = `${period}-01`;
  const endDate = new Date(parseInt(yearStr), parseInt(monthStr), 0).toISOString().split('T')[0];

  // Delete transactions
  const { error: deleteError } = await atelierTableAdmin('transactions')
    .delete()
    .gte('date', startDate)
    .lte('date', endDate);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Delete file from storage (best effort)
  const { data: files } = await supabaseAdmin.storage
    .from('atelier-docs')
    .list(`extractos/${period}`);

  if (files && files.length > 0) {
    const paths = files.map(f => `extractos/${period}/${f.name}`);
    await supabaseAdmin.storage.from('atelier-docs').remove(paths);
    // Also remove the folder entry
    await supabaseAdmin.storage.from('atelier-docs').remove([`extractos/${period}`]);
  }

  return NextResponse.json({ success: true, period });
}
