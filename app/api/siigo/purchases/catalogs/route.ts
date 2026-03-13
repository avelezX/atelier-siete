import { NextResponse } from 'next/server';
import { fetchDocumentTypes, fetchTaxes, fetchPurchasePaymentTypes } from '@/lib/siigo';

export const dynamic = 'force-dynamic';

/**
 * GET /api/siigo/purchases/catalogs
 * Catálogos para crear una factura de compra:
 * - documentTypes (tipo FC)
 * - taxes (IVA)
 * - paymentTypes (FC)
 */
export async function GET() {
  try {
    const [documentTypes, taxes, paymentTypes] = await Promise.all([
      fetchDocumentTypes('FC'),
      fetchTaxes(),
      fetchPurchasePaymentTypes(),
    ]);

    return NextResponse.json({
      documentTypes: Array.isArray(documentTypes) ? documentTypes : [],
      taxes,
      paymentTypes,
    });
  } catch (err: any) {
    console.error('[/api/siigo/purchases/catalogs] Error:', err.message);
    return NextResponse.json({ error: err.message || 'Error al obtener catálogos de compra' }, { status: 500 });
  }
}
