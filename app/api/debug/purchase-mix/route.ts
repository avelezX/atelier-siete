import { NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

export const maxDuration = 60;

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

// Diagnose: which suppliers appear in 6135/1435 purchase items?
// Are they own-product suppliers or consignment suppliers?
export async function GET() {
  try {
    // 1. Get consignment vs own product suppliers
    const products = await fetchAllRows(
      'products',
      'code, supplier_name, is_consignment, account_group_name'
    );

    const consignmentSuppliers = new Set<string>();
    const ownSuppliers = new Set<string>();
    products.forEach((p) => {
      const supplier = (p.supplier_name as string) || '';
      if (!supplier) return;
      if (p.is_consignment) consignmentSuppliers.add(supplier);
      else ownSuppliers.add(supplier);
    });

    // Some suppliers might have both own and consignment products
    const mixedSuppliers = new Set<string>();
    consignmentSuppliers.forEach((s) => {
      if (ownSuppliers.has(s)) mixedSuppliers.add(s);
    });

    // 2. Get ALL purchase items with 6135/1435
    const modernItems = await fetchAllRows(
      'purchase_items',
      'purchase_id, account_code, price, quantity',
      (q) => q.or('account_code.like.6135%,account_code.like.1435%')
    );

    // 3. Get purchases for supplier mapping
    const purchases = await fetchAllRows('purchases', 'id, date, supplier_name');
    const purchaseMap = new Map<string, { date: string; supplier: string }>();
    purchases.forEach((p) => {
      purchaseMap.set(p.id as string, {
        date: (p.date as string) || '',
        supplier: (p.supplier_name as string) || '',
      });
    });

    // 4. Classify modern purchase items by supplier type
    interface SupplierPurchaseStats {
      supplier: string;
      type: 'own' | 'consignment' | 'mixed' | 'unknown';
      total_value: number;
      item_count: number;
      months: Set<string>;
    }

    const supplierStats = new Map<string, SupplierPurchaseStats>();

    modernItems.forEach((pi) => {
      const pInfo = purchaseMap.get(pi.purchase_id as string);
      if (!pInfo) return;
      const supplier = pInfo.supplier;
      const value = (Number(pi.price) || 0) * (Number(pi.quantity) || 1);
      const month = pInfo.date.substring(0, 7);

      if (!supplierStats.has(supplier)) {
        let type: 'own' | 'consignment' | 'mixed' | 'unknown' = 'unknown';
        if (mixedSuppliers.has(supplier)) type = 'mixed';
        else if (consignmentSuppliers.has(supplier)) type = 'consignment';
        else if (ownSuppliers.has(supplier)) type = 'own';

        supplierStats.set(supplier, {
          supplier,
          type,
          total_value: 0,
          item_count: 0,
          months: new Set(),
        });
      }
      const entry = supplierStats.get(supplier)!;
      entry.total_value += value;
      entry.item_count += 1;
      entry.months.add(month);
    });

    // 5. Also check historical (product-code account) items
    const allPurchaseItems = await fetchAllRows(
      'purchase_items',
      'purchase_id, account_code, price, quantity'
    );

    const KNOWN_PUC_PREFIXES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const historicalItems = allPurchaseItems.filter((pi) => {
      const code = (pi.account_code as string) || '';
      return code.length > 0 && !KNOWN_PUC_PREFIXES.includes(code[0]);
    });

    // Own product codes
    const ownProductCodes = new Set(
      products.filter((p) => !p.is_consignment).map((p) => (p.code as string) || '')
    );
    const consignmentProductCodes = new Set(
      products.filter((p) => p.is_consignment).map((p) => (p.code as string) || '')
    );

    let historicalOwnValue = 0;
    let historicalConsignmentValue = 0;
    let historicalUnknownValue = 0;
    let historicalOwnCount = 0;
    let historicalConsignmentCount = 0;
    let historicalUnknownCount = 0;
    const unknownCodes = new Set<string>();

    historicalItems.forEach((pi) => {
      const code = (pi.account_code as string) || '';
      const value = (Number(pi.price) || 0) * (Number(pi.quantity) || 1);
      if (ownProductCodes.has(code)) {
        historicalOwnValue += value;
        historicalOwnCount++;
      } else if (consignmentProductCodes.has(code)) {
        historicalConsignmentValue += value;
        historicalConsignmentCount++;
      } else {
        historicalUnknownValue += value;
        historicalUnknownCount++;
        if (unknownCodes.size < 30) unknownCodes.add(code);
      }
    });

    // Format results
    const supplierList = Array.from(supplierStats.values())
      .sort((a, b) => b.total_value - a.total_value)
      .map((s) => ({
        supplier: s.supplier,
        type: s.type,
        total_value: Math.round(s.total_value),
        item_count: s.item_count,
        month_range: Array.from(s.months).sort().join(', '),
      }));

    const totalByType = {
      own: supplierList.filter((s) => s.type === 'own').reduce((t, s) => t + s.total_value, 0),
      consignment: supplierList.filter((s) => s.type === 'consignment').reduce((t, s) => t + s.total_value, 0),
      mixed: supplierList.filter((s) => s.type === 'mixed').reduce((t, s) => t + s.total_value, 0),
      unknown: supplierList.filter((s) => s.type === 'unknown').reduce((t, s) => t + s.total_value, 0),
    };

    return NextResponse.json({
      supplier_classification: {
        own_only: Array.from(ownSuppliers).filter((s) => !mixedSuppliers.has(s)),
        consignment_only: Array.from(consignmentSuppliers).filter((s) => !mixedSuppliers.has(s)),
        mixed: Array.from(mixedSuppliers),
      },
      modern_6135_1435: {
        total_items: modernItems.length,
        by_type: totalByType,
        suppliers: supplierList,
      },
      historical_product_codes: {
        total_items: historicalItems.length,
        own: { count: historicalOwnCount, value: Math.round(historicalOwnValue) },
        consignment: { count: historicalConsignmentCount, value: Math.round(historicalConsignmentValue) },
        unknown: { count: historicalUnknownCount, value: Math.round(historicalUnknownValue), sample_codes: Array.from(unknownCodes) },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
