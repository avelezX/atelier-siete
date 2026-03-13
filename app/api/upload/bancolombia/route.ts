import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin, atelierTableAdmin } from '@/lib/supabase';
import { parseBancolombiaExcel } from '@/lib/bancolombia-parser';
import { fetchCategorizationRules, categorizeTransaction } from '@/lib/categorization';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ error: 'El archivo debe ser .xlsx' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Archivo muy grande (max 10MB)' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    let parseResult;
    try {
      parseResult = parseBancolombiaExcel(arrayBuffer, file.name);
    } catch (e: any) {
      return NextResponse.json({ error: 'Error parseando Excel', details: e.message }, { status: 400 });
    }

    if (parseResult.transactions.length === 0) {
      return NextResponse.json({ error: 'No se encontraron transacciones en el archivo' }, { status: 400 });
    }

    const { period, transactions, metadata } = parseResult;
    const [yearStr, monthStr] = period.split('-');
    const startDate = `${period}-01`;
    const endDate = new Date(parseInt(yearStr), parseInt(monthStr), 0).toISOString().split('T')[0];

    // Check for duplicates
    const { count: existingCount } = await atelierTableAdmin('transactions')
      .select('*', { count: 'exact', head: true })
      .gte('date', startDate)
      .lte('date', endDate);

    const force = request.nextUrl.searchParams.get('force') === 'true';

    if (existingCount && existingCount > 0 && !force) {
      return NextResponse.json({
        error: 'duplicate',
        message: `Ya existen ${existingCount} transacciones para ${period}`,
        existingCount,
        newCount: transactions.length,
        period,
        metadata,
      }, { status: 409 });
    }

    if (force && existingCount && existingCount > 0) {
      const { error: deleteError } = await atelierTableAdmin('transactions')
        .delete()
        .gte('date', startDate)
        .lte('date', endDate);

      if (deleteError) {
        return NextResponse.json({ error: 'Error eliminando transacciones existentes', details: deleteError.message }, { status: 500 });
      }
    }

    // Upload to Supabase Storage
    const storagePath = `extractos/${period}/${file.name}`;
    let storageSuccess = true;
    const { error: storageError } = await supabaseAdmin.storage
      .from('atelier-docs')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      });

    if (storageError) {
      console.error('[storage] upload error:', storageError.message);
      storageSuccess = false;
    }

    // Categorize and insert
    const rules = await fetchCategorizationRules();
    const categorized = transactions.map(t => ({
      ...t,
      period,
      category: categorizeTransaction(t.description, rules),
    }));

    const BATCH_SIZE = 100;
    let insertedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < categorized.length; i += BATCH_SIZE) {
      const batch = categorized.slice(i, i + BATCH_SIZE);
      const { error } = await atelierTableAdmin('transactions').insert(batch);
      if (error) {
        errors.push(`Batch ${i + 1}-${i + batch.length}: ${error.message}`);
      } else {
        insertedCount += batch.length;
      }
    }

    const categorySummary: Record<string, number> = {};
    for (const t of categorized) {
      const cat = t.category || 'Sin categoria';
      categorySummary[cat] = (categorySummary[cat] || 0) + 1;
    }

    revalidatePath('/bancos/extractos');
    revalidatePath('/bancos/transacciones');

    return NextResponse.json({
      success: true,
      period,
      totalParsed: transactions.length,
      totalInserted: insertedCount,
      storagePath: storageSuccess ? storagePath : null,
      storageError: storageError ? storageError.message : null,
      categorySummary,
      warnings: parseResult.warnings,
      errors,
      metadata,
    });
  } catch (e: any) {
    console.error('[upload/bancolombia] Error:', e);
    return NextResponse.json({ error: 'Error interno del servidor', details: e.message }, { status: 500 });
  }
}
