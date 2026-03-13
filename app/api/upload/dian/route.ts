import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, atelierTableAdmin } from '@/lib/supabase';
import { parseDianExcel } from '@/lib/dian-parser';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    // Optional override: 'Recibido' (compras) or 'Emitido' (ventas)
    const groupOverride = formData.get('group_override') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ error: 'El archivo debe ser .xlsx' }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'Archivo muy grande (max 20MB)' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();

    let parseResult;
    try {
      parseResult = parseDianExcel(buffer);
    } catch (e: any) {
      return NextResponse.json(
        { error: 'Error parseando Excel DIAN', details: e.message },
        { status: 400 }
      );
    }

    if (parseResult.documents.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron facturas en el archivo (solo Application responses)' },
        { status: 400 }
      );
    }

    const { documents, period, skipped, warnings } = parseResult;

    // Apply group override if provided
    const normalizedDocuments = groupOverride
      ? documents.map(d => ({ ...d, document_group: groupOverride }))
      : documents;

    // Check for duplicates by CUFE
    const force = request.nextUrl.searchParams.get('force') === 'true';
    const confirm = request.nextUrl.searchParams.get('confirm') === 'true';
    const cufes = normalizedDocuments.map(d => d.cufe);

    const { data: existing } = await atelierTableAdmin('dian_documents')
      .select('cufe')
      .in('cufe', cufes);

    const existingCufes = new Set((existing || []).map((r: any) => r.cufe));
    const newDocuments = normalizedDocuments.filter(d => !existingCufes.has(d.cufe));
    const duplicateCount = normalizedDocuments.length - newDocuments.length;

    if (duplicateCount > 0 && newDocuments.length === 0 && !force && !confirm) {
      return NextResponse.json({
        error: 'duplicate',
        message: `Todos los ${duplicateCount} documentos ya existen en la base de datos`,
        existingCount: duplicateCount,
        newCount: 0,
        period,
      }, { status: 409 });
    }

    if (duplicateCount > 0 && !force && !confirm) {
      return NextResponse.json({
        error: 'duplicate',
        message: `${duplicateCount} documentos ya existen, ${newDocuments.length} son nuevos`,
        existingCount: duplicateCount,
        newCount: newDocuments.length,
        period,
      }, { status: 409 });
    }

    const toInsert = force ? normalizedDocuments : newDocuments;

    // Upload file to Supabase Storage (optional — continues if bucket doesn't exist)
    let storagePath = null;
    try {
      const path = `dian/${Date.now()}-${file.name}`;
      const { error: storageError } = await supabaseAdmin.storage
        .from('atelier-docs')
        .upload(path, buffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: true,
        });
      if (!storageError) storagePath = path;
    } catch {
      // Storage optional
    }

    // Insert in batches of 100
    const BATCH_SIZE = 100;
    let insertedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const query = atelierTableAdmin('dian_documents');
      const { error } = force
        ? await query.upsert(batch, { onConflict: 'cufe' })
        : await query.insert(batch);
      if (error) {
        errors.push(`Batch ${i + 1}-${i + batch.length}: ${error.message}`);
      } else {
        insertedCount += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      period,
      totalParsed: documents.length,
      totalInserted: insertedCount,
      duplicatesSkipped: duplicateCount,
      skippedRows: skipped,
      storagePath,
      warnings,
      errors,
    });
  } catch (e: any) {
    console.error('DIAN upload error:', e);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: e.message },
      { status: 500 }
    );
  }
}
