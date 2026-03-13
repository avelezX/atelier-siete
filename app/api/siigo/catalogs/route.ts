import { NextResponse } from 'next/server';
import { fetchAllCustomers, fetchAllProducts, fetchTaxes, fetchPaymentTypes } from '@/lib/siigo';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [customers, products, taxes, paymentTypes] = await Promise.all([
      fetchAllCustomers(),
      fetchAllProducts(),
      fetchTaxes(),
      fetchPaymentTypes(),
    ]);
    return NextResponse.json({ customers, products, taxes, paymentTypes });
  } catch (err: any) {
    console.error('[/api/siigo/catalogs] Error:', err.message);
    return NextResponse.json({ error: err.message || 'Error al obtener catálogos de Siigo' }, { status: 500 });
  }
}
