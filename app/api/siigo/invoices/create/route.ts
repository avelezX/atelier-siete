import { NextRequest, NextResponse } from 'next/server';
import { createInvoice } from '@/lib/siigo';
import type { SiigoCreateInvoiceRequest } from '@/types/siigo';

const DOCUMENT_TYPE_ID = parseInt(process.env.SIIGO_DOCUMENT_TYPE_ID || '0');
const SELLER_ID = parseInt(process.env.SIIGO_SELLER_ID || '0');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerIdentification, date, dueDate, items, paymentTypeId, observations, sendEmail, sendStamp } = body;

    if (!customerIdentification) return NextResponse.json({ error: 'Se requiere identificación del cliente' }, { status: 400 });
    if (!items || items.length === 0) return NextResponse.json({ error: 'Se requiere al menos un ítem' }, { status: 400 });
    if (!paymentTypeId) return NextResponse.json({ error: 'Se requiere forma de pago' }, { status: 400 });
    if (!DOCUMENT_TYPE_ID) return NextResponse.json({ error: 'Falta SIIGO_DOCUMENT_TYPE_ID en .env.local' }, { status: 500 });

    let grandTotal = 0;
    for (const item of items) {
      const subtotal = Math.round(item.quantity * item.price * (1 - (item.discount || 0) / 100));
      const taxAmount = subtotal * ((item.taxPercentage || 0) / 100);
      grandTotal += subtotal + taxAmount;
    }
    grandTotal = Math.round(grandTotal * 100) / 100;

    const invoicePayload: SiigoCreateInvoiceRequest = {
      document: { id: DOCUMENT_TYPE_ID },
      date,
      customer: { identification: customerIdentification },
      ...(SELLER_ID ? { seller: SELLER_ID } : {}),
      stamp: { send: Boolean(sendStamp) },
      mail: { send: Boolean(sendEmail) },
      observations: observations || undefined,
      items: items.map((item: any) => ({
        code: item.code,
        description: item.description || undefined,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount || 0,
        taxes: item.taxId ? [{ id: item.taxId }] : [],
      })),
      payments: [{ id: paymentTypeId, value: grandTotal, due_date: dueDate || date }],
    };

    const invoice = await createInvoice(invoicePayload);

    if (invoice.errors && invoice.errors.length > 0) {
      const errMsg = invoice.errors.map((e) => e.Message).join('; ');
      return NextResponse.json({ error: errMsg }, { status: 422 });
    }

    return NextResponse.json({ invoice });
  } catch (err: any) {
    console.error('[/api/siigo/invoices/create] Error:', err.message);
    return NextResponse.json({ error: err.message || 'Error al crear la factura' }, { status: 500 });
  }
}
