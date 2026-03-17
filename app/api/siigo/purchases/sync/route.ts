import { NextResponse } from 'next/server';
import { fetchDocumentTypes, fetchPurchasePaymentTypes, createPurchase, createSupplier } from '@/lib/siigo';
import { atelierTableAdmin } from '@/lib/supabase';
import type { SiigoCreatePurchaseRequest } from '@/types/siigo';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Asigna automáticamente el código de cuenta contable según el proveedor.
 * Adaptado para Atelier Siete (muebles y decoración).
 */
function resolveAccountCode(issuerName: string): { code: string; label: string } {
  const n = issuerName.toUpperCase();

  // ── Arrendamientos ─────────────────────────────────────────
  if (/INMOBILIARIA|ARRENDAMIENTO|ARRIENDO/.test(n))
    return { code: '51201001', label: 'Arrendamientos' };

  // ── Servicios públicos ─────────────────────────────────────
  if (/ACUEDUCTO|AGUAS|EPA|AGUAS MANIZALES|EMPRESAS PUBLICAS|AGUA/.test(n))
    return { code: '51351001', label: 'Servicios públicos - Acueducto' };
  if (/ELECTRICAS|ENERGIA|ELECTRICA|CHEC|CODENSA|EPM/.test(n))
    return { code: '51353001', label: 'Servicios públicos - Energía' };
  if (/GAS|GASES DE OCCIDENTE|SURTIGAS|GASNOVA/.test(n))
    return { code: '51352001', label: 'Servicios públicos - Gas' };

  // ── Telecomunicaciones ─────────────────────────────────────
  if (/COMUNICACION CELULAR|COMCEL|CLARO|MOVISTAR|ETB|UNE |TIGO/.test(n))
    return { code: '51353502', label: 'Telecomunicaciones - Celular' };
  if (/INTERNET|FIBRA|BANDA ANCHA/.test(n))
    return { code: '51353501', label: 'Telecomunicaciones - Internet' };

  // ── Seguros ────────────────────────────────────────────────
  if (/SEGURO|MAPFRE|BOLIVAR.*SEGURO|ESTADO.*SEGURO|SURAMERICANA/.test(n))
    return { code: '51303001', label: 'Seguros' };

  // ── Servicios tecnológicos / software ─────────────────────
  if (/SIIGO|F2X|SOFTWARE|PROCESAMIENTO|PAYU|PAGOS AUTOMATICOS/.test(n))
    return { code: '51352001', label: 'Procesamiento electrónico de datos' };

  // ── Transporte / mensajería ────────────────────────────────
  if (/SERVIENTREGA|COORDINADORA|DEPRISA|FEDEX|DHL|TRANSPORTES|MENSAJERIA|FLETE/.test(n))
    return { code: '51959501', label: 'Otros gastos (transporte)' };

  // ── Publicidad ─────────────────────────────────────────────
  if (/PUBLICIDAD|MARKETING|AGENCIA|META |FACEBOOK|GOOGLE|INSTAGRAM/.test(n))
    return { code: '51959501', label: 'Otros gastos (publicidad)' };

  // ── Mantenimiento y reparación ─────────────────────────────
  if (/MANTENIMIENTO|REPARACION|OBRA|PINTURA|ELECTRICO|PLOMERO|INSTALACION/.test(n))
    return { code: '51451001', label: 'Mantenimiento - Construcciones' };

  // ── Papelería / útiles ─────────────────────────────────────
  if (/PAPELERIA|LIBRERIA|UTILES|OFICIO/.test(n))
    return { code: '51952501', label: 'Útiles y papelería' };

  // ── Honorarios profesionales ───────────────────────────────
  if (/CONTADOR|REVISOR|AUDITOR|JURIDIC|ABOGAD|ASESOR/.test(n))
    return { code: '51102501', label: 'Honorarios profesionales' };

  // ── Gastos bancarios ───────────────────────────────────────
  if (/BANCO|BANCOLOMBIA|DAVIVIENDA|BBVA|OCCIDENTE|BOGOTA|COMISION/.test(n))
    return { code: '53050501', label: 'Gastos bancarios' };

  // ── Fallback: Otros gastos ─────────────────────────────────
  return { code: '51959501', label: 'Otros gastos' };
}

/**
 * POST /api/siigo/purchases/sync
 * Sincroniza masivamente las facturas recibidas DIAN → Siigo como compras.
 * Solo procesa las que no tienen siigo_purchase_id (pendientes).
 *
 * Body (opcional): { month?: "2026-01" }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { month, year } = body as { month?: string; year?: string };

    // 1. Cargar catálogos Siigo
    const [documentTypes, paymentTypes] = await Promise.all([
      fetchDocumentTypes('FC'),
      fetchPurchasePaymentTypes(),
    ]);

    const fcTypes = Array.isArray(documentTypes) ? documentTypes : [];
    // Usar "Compra" (no inventario) — primer FC type
    const defaultDocType = fcTypes.find((t: any) => t.name === 'Compra') ?? fcTypes[0];

    const paymentList = Array.isArray(paymentTypes) ? paymentTypes : [];
    // Siempre registrar en Efectivo (id 316, CarteraProveedor)
    const defaultPayment =
      paymentList.find((p: any) => p.name === 'Efectivo') ??
      paymentList.find((p: any) => p.id === 316) ??
      null;

    if (!defaultDocType) {
      return NextResponse.json({ error: 'No se encontraron tipos de documento FC en Siigo.' }, { status: 422 });
    }
    if (!defaultPayment) {
      return NextResponse.json({ error: 'No se encontró el método de pago Efectivo en Siigo.' }, { status: 422 });
    }

    // 2. Traer documentos DIAN pendientes (Recibido, tipo Factura, sin siigo_purchase_id)
    let query = (atelierTableAdmin('dian_documents') as any)
      .select('id, cufe, number, prefix, issue_date, issuer_nit, issuer_name, amount, tax_amount, document_type')
      .eq('document_group', 'Recibido')
      .ilike('document_type', '%Factura%')
      .is('siigo_purchase_id', null)
      .order('issue_date', { ascending: true });

    if (month) {
      const [y, mon] = month.split('-');
      const startDate = `${month}-01`;
      const endDate = new Date(parseInt(y), parseInt(mon), 0).toISOString().split('T')[0];
      query = query.gte('issue_date', startDate).lte('issue_date', endDate);
    } else if (year) {
      query = query.gte('issue_date', `${year}-01-01`).lte('issue_date', `${year}-12-31`);
    }

    const { data: pending, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!pending || pending.length === 0) {
      return NextResponse.json({ created: 0, errors: [], total: 0, message: 'No hay facturas pendientes de sincronizar' });
    }

    // 3. Procesar cada factura
    let created = 0;
    const errors: Array<{ folio: string; issuer: string; error: string; accountCode?: string }> = [];

    for (const doc of pending) {
      const folio = doc.prefix ? `${doc.prefix}-${doc.number}` : doc.number;

      const rawNum = String(doc.number);
      const providerPrefix = doc.prefix
        ? String(doc.prefix).substring(0, 6)
        : rawNum.substring(0, 6);
      const providerNumber = doc.prefix
        ? rawNum
        : (rawNum.substring(6) || rawNum.slice(-4) || '1');

      const { code: accountCode, label: accountLabel } = resolveAccountCode(doc.issuer_name || '');

      const itemPrice = Math.round(doc.amount || 0);
      if (itemPrice <= 0) {
        errors.push({ folio, issuer: doc.issuer_name, error: 'Monto inválido (≤ 0), se omite' });
        continue;
      }

      const payload: SiigoCreatePurchaseRequest = {
        document: { id: defaultDocType.id },
        date: doc.issue_date,
        supplier: {
          identification: String(doc.issuer_nit).trim(),
          branch_office: 0,
        },
        provider_invoice: {
          prefix: providerPrefix,
          number: providerNumber,
        },
        items: [{
          type: 'Account',
          code: accountCode,
          description: `${doc.issuer_name} - ${folio}`.substring(0, 100),
          quantity: 1,
          price: itemPrice,
          discount: 0,
          taxes: [],
        }],
        payments: [{
          id: defaultPayment.id,
          value: itemPrice,
          due_date: doc.issue_date,
        }],
        observations: `DIAN. CUFE: ${(doc.cufe || '').substring(0, 80)}`,
      };

      try {
        const result = await createPurchase(payload);

        if (result.errors && result.errors.length > 0) {
          const errMsg = result.errors.map((e: any) => e.message ?? e.Message).join('; ');
          errors.push({ folio, issuer: doc.issuer_name, error: errMsg, accountCode: `${accountCode} (${accountLabel})` });
          continue;
        }

        if (!result.id) {
          errors.push({ folio, issuer: doc.issuer_name, error: 'Siigo no devolvió ID de compra', accountCode });
          continue;
        }

        await (atelierTableAdmin('dian_documents') as any)
          .update({ siigo_purchase_id: result.id, siigo_synced_at: new Date().toISOString() })
          .eq('id', doc.id);

        created++;
        await new Promise((r) => setTimeout(r, 1200));
      } catch (err: any) {
        const errMsg: string = err.message ?? '';

        // Proveedor no existe → auto-crear y reintentar
        const isSupplierError = errMsg.includes('customer_settings') || errMsg.includes('invalid_reference');
        if (isSupplierError) {
          try {
            console.log(`[sync] Auto-creando proveedor: ${doc.issuer_name} (${doc.issuer_nit})`);
            await createSupplier(String(doc.issuer_nit).trim(), doc.issuer_name);
            await new Promise((r) => setTimeout(r, 1500));
            const retryResult = await createPurchase(payload);
            if (retryResult.id) {
              await (atelierTableAdmin('dian_documents') as any)
                .update({ siigo_purchase_id: retryResult.id, siigo_synced_at: new Date().toISOString() })
                .eq('id', doc.id);
              created++;
              await new Promise((r) => setTimeout(r, 1200));
              continue;
            }
            errors.push({ folio, issuer: doc.issuer_name, error: 'Proveedor creado pero Siigo no devolvió ID', accountCode });
          } catch (retryErr: any) {
            errors.push({ folio, issuer: doc.issuer_name, error: `Auto-creación proveedor falló: ${retryErr.message}`, accountCode });
          }
          continue;
        }

        errors.push({ folio, issuer: doc.issuer_name, error: errMsg, accountCode });
        if (errMsg.includes('429') || errMsg.includes('Rate limit')) {
          await new Promise((r) => setTimeout(r, 35000));
        }
      }
    }

    return NextResponse.json({ created, errors, total: pending.length });
  } catch (err: any) {
    console.error('[/api/siigo/purchases/sync] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
