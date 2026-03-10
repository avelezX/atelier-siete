import { NextRequest, NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

/*
  Table SQL (run once in Supabase SQL Editor):

  CREATE TABLE atelier_bp_notes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    account_code text NOT NULL,
    month text NOT NULL,
    year integer NOT NULL DEFAULT 2025,
    note text NOT NULL,
    invoice_number text,
    supplier text,
    amount numeric,
    created_at timestamptz DEFAULT now()
  );
*/

// GET — fetch notes, optionally filtered by year
export async function GET(req: NextRequest) {
  try {
    const year = parseInt(req.nextUrl.searchParams.get('year') || '2025');

    const { data, error } = await atelierTableAdmin('bp_notes')
      .select('*')
      .eq('year', year)
      .order('created_at', { ascending: false });

    if (error) {
      // Table doesn't exist yet
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({ notes: [], table_missing: true });
      }
      throw error;
    }

    return NextResponse.json({ notes: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — create a note
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { account_code, month, year, note, invoice_number, supplier, amount } = body;

    if (!account_code || !month || !note) {
      return NextResponse.json({ error: 'account_code, month, and note are required' }, { status: 400 });
    }

    const { data, error } = await atelierTableAdmin('bp_notes')
      .insert({
        account_code,
        month,
        year: year || 2025,
        note,
        invoice_number: invoice_number || null,
        supplier: supplier || null,
        amount: amount || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ note: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — delete a note by ID
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { error } = await atelierTableAdmin('bp_notes')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
