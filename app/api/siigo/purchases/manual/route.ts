import { NextRequest, NextResponse } from 'next/server';
import { createPurchase, createSupplier } from '@/lib/siigo';
import type { SiigoCreatePurchaseRequest } from '@/types/siigo';

/**
 * POST /api/siigo/purchases/manual
 * Crea una factura de compra en Siigo manualmente (sin documento DIAN asociado).
 *
 * Body:
 * {
 *   documentTypeId: number,
 *   date: string,
 *   dueDate?: string,
 *   supplierIdentification: string,
 *   providerPrefix?: string,
 *   providerNumber?: string,
 *   items: Array<{ code: string; description: string; quantity: number; price: number; discount?: number; taxId?: number }>,
 *   paymentTypeId: number,
 *   observations?: string,
 *   autoCreateSupplier?: boolean,
 *   supplierName?: string,
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      documentTypeId, date, dueDate,
      supplierIdentification, providerPrefix, providerNumber,
      items, paymentTypeId, observations,
      autoCreateSupplier, supplierName,
    } = body;

    if (!documentTypeId) return NextResponse.json({ error: 'Se requiere documentTypeId' }, { status: 400 });
    if (!date) return NextResponse.json({ error: 'Se requiere fecha' }, { status: 400 });
    if (!supplierIdentification) return NextResponse.json({ error: 'Se requiere NIT del proveedor' }, { status: 400 });
    if (!items || items.length === 0) return NextResponse.json({ error: 'Se requiere al menos un ítem' }, { status: 400 });
    if (!paymentTypeId) return NextResponse.json({ error: 'Se requiere forma de pago' }, { status: 400 });

    const grandTotal = items.reduce((sum: number, item: any) => {
      const subtotal = Math.round(item.quantity * item.price * (1 - (item.discount || 0) / 100));
      const taxAmt = subtotal * ((item.taxPercentage || 0) / 100);
      return sum + subtotal + taxAmt;
    }, 0);

    const payload: SiigoCreatePurchaseRequest = {
      document: { id: Number(documentTypeId) },
      date,
      supplier: { identification: String(supplierIdentification).trim(), branch_office: 0 },
      ...(providerPrefix || providerNumber ? {
        provider_invoice: {
          prefix: providerPrefix || undefined,
          number: providerNumber || undefined,
        },
      } : {}),
      items: items.map((item: any) => ({
        type: (item.itemType as 'Account' | 'Product' | 'FixedAsset') || 'Account',
        code: item.code,
        description: item.description || undefined,
        quantity: item.quantity,
        price: Math.round(item.price * (1 - (item.discount || 0) / 100)),
        discount: 0,
        taxes: item.taxId ? [{ id: Number(item.taxId) }] : [],
      })),
      payments: [{ id: Number(paymentTypeId), value: Math.round(grandTotal), due_date: dueDate || date }],
      observations: observations || undefined,
    };

    const tryCreate = async () => {
      const result = await createPurchase(payload);
      if (result.errors && result.errors.length > 0) {
        const errMsg = result.errors.map((e) => e.Message).join('; ');
        throw new Error(errMsg);
      }
      return result;
    };

    try {
      const result = await tryCreate();
      return NextResponse.json({ purchase: result });
    } catch (err: any) {
      const errMsg: string = err.message ?? '';
      const isSupplierError = errMsg.includes('customer_settings') || errMsg.includes('invalid_reference');

      if (isSupplierError && autoCreateSupplier && supplierName) {
        console.log(`[manual] Auto-creando proveedor: ${supplierName} (${supplierIdentification})`);
        await createSupplier(String(supplierIdentification).trim(), supplierName);
        await new Promise((r) => setTimeout(r, 1500));
        const result = await tryCreate();
        return NextResponse.json({ purchase: result, supplierCreated: true });
      }

      return NextResponse.json({ error: errMsg || 'Error al crear compra en Siigo' }, { status: 422 });
    }
  } catch (err: any) {
    console.error('[/api/siigo/purchases/manual] Error:', err.message);
    return NextResponse.json({ error: err.message || 'Error al crear la factura de compra' }, { status: 500 });
  }
}
