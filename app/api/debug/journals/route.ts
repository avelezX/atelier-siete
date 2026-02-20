import { NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

export const maxDuration = 60;

// Fetch all rows handling Supabase 1000 row limit
async function fetchAllRows(
  table: string,
  select: string,
  applyFilters?: (query: ReturnType<typeof atelierTableAdmin>) => ReturnType<typeof atelierTableAdmin>
) {
  const PAGE_SIZE = 1000;
  let allData: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    let query = atelierTableAdmin(table).select(select).range(from, from + PAGE_SIZE - 1);
    if (applyFilters) query = applyFilters(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allData;
}

// GET /api/debug/journals
export async function GET() {
  try {
    // a) Get the MAX date from atelier_journals
    const { data: maxDateRow, error: maxDateErr } = await atelierTableAdmin('journals')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (maxDateErr) throw new Error(`Max date query: ${maxDateErr.message}`);
    const maxDate = maxDateRow?.date as string;

    // b) Fetch all journals to count per month (last 6 months)
    const allJournals = await fetchAllRows('journals', 'id, date, name');

    // Count journals per month
    const journalsByMonth = new Map<string, number>();
    const journalNamesByMonth = new Map<string, string[]>();

    allJournals.forEach((j) => {
      const date = j.date as string;
      if (!date) return;
      const month = date.substring(0, 7);
      journalsByMonth.set(month, (journalsByMonth.get(month) || 0) + 1);

      // Collect names for the month
      if (!journalNamesByMonth.has(month)) {
        journalNamesByMonth.set(month, []);
      }
      const names = journalNamesByMonth.get(month)!;
      if (names.length < 10) {
        names.push(j.name as string);
      }
    });

    // Sort months and get last 6
    const sortedMonths = Array.from(journalsByMonth.keys()).sort();
    const last6Months = sortedMonths.slice(-6);

    const journalsPerMonth = last6Months.map((month) => ({
      month,
      count: journalsByMonth.get(month) || 0,
    }));

    // All months for 2025 and 2026
    const months2025and2026 = sortedMonths.filter(
      (m) => m.startsWith('2025') || m.startsWith('2026')
    );
    const journalsPerMonth2025_2026 = months2025and2026.map((month) => ({
      month,
      count: journalsByMonth.get(month) || 0,
    }));

    // c) Sample journal names from last 3 months
    const last3Months = sortedMonths.slice(-3);
    const sampleNamesByMonth = last3Months.map((month) => ({
      month,
      sample_names: journalNamesByMonth.get(month) || [],
      total_count: journalsByMonth.get(month) || 0,
    }));

    // Check for CC (comprobante contable) type journals in last 3 months
    const ccJournalsLast3 = last3Months.map((month) => {
      const names = journalNamesByMonth.get(month) || [];
      const ccNames = names.filter((n) => n.startsWith('CC') || n.includes('CC'));
      return {
        month,
        total_journals: journalsByMonth.get(month) || 0,
        cc_journals_in_sample: ccNames.length,
        cc_sample_names: ccNames.slice(0, 5),
      };
    });

    // d) Count journal_items with account_code LIKE '6135%' per month for last 6 months
    const cogsItems = await fetchAllRows(
      'journal_items',
      'journal_id, account_code, movement, value',
      (q) => q.like('account_code', '6135%')
    );

    // Build journal_id -> date map
    const journalDateMap = new Map<string, string>();
    allJournals.forEach((j) => {
      journalDateMap.set(j.id as string, (j.date as string) || '');
    });

    const cogsByMonth = new Map<string, { count: number; total_value: number }>();
    cogsItems.forEach((item) => {
      const journalDate = journalDateMap.get(item.journal_id as string);
      if (!journalDate) return;
      const month = journalDate.substring(0, 7);
      const curr = cogsByMonth.get(month) || { count: 0, total_value: 0 };
      curr.count += 1;
      curr.total_value += Number(item.value) || 0;
      cogsByMonth.set(month, curr);
    });

    const cogsPerMonth = last6Months.map((month) => ({
      month,
      items_count: cogsByMonth.get(month)?.count || 0,
      total_value: Math.round((cogsByMonth.get(month)?.total_value || 0) * 100) / 100,
    }));

    // e) Last 5 journals by date with their item counts
    const { data: last5Journals, error: last5Err } = await atelierTableAdmin('journals')
      .select('id, siigo_id, date, name, number, document_id, observations')
      .order('date', { ascending: false })
      .limit(5);

    if (last5Err) throw new Error(`Last 5 journals: ${last5Err.message}`);

    // Get item counts for these journals
    const last5WithItems = await Promise.all(
      (last5Journals || []).map(async (j: Record<string, unknown>) => {
        const { count, error: countErr } = await atelierTableAdmin('journal_items')
          .select('*', { count: 'exact', head: true })
          .eq('journal_id', j.id);

        // Also get sample items
        const { data: sampleItems } = await atelierTableAdmin('journal_items')
          .select('account_code, movement, value, description, product_code')
          .eq('journal_id', j.id)
          .limit(5);

        return {
          ...j,
          item_count: countErr ? `error: ${countErr.message}` : count,
          sample_items: sampleItems || [],
        };
      })
    );

    // Summary stats
    const allMonthsSorted = Array.from(journalsByMonth.keys()).sort();
    const firstMonth = allMonthsSorted[0];
    const lastMonth = allMonthsSorted[allMonthsSorted.length - 1];

    return NextResponse.json({
      summary: {
        total_journals: allJournals.length,
        total_cogs_items: cogsItems.length,
        date_range: { first: firstMonth, last: lastMonth },
        max_journal_date: maxDate,
        total_months_with_data: allMonthsSorted.length,
      },
      journals_per_month_last_6: journalsPerMonth,
      journals_per_month_2025_2026: journalsPerMonth2025_2026,
      cc_journals_analysis: ccJournalsLast3,
      sample_names_last_3_months: sampleNamesByMonth,
      cogs_6135_per_month_last_6: cogsPerMonth,
      last_5_journals: last5WithItems,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
