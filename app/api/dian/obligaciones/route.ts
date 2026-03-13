import { NextRequest, NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

// GET /api/dian/obligaciones?year=2026   → obligaciones con due_date en ese año
// GET /api/dian/obligaciones             → todas las obligaciones
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const year = searchParams.get('year');

    let query = (atelierTableAdmin('dian_obligations') as any)
      .select('*')
      .order('due_date', { ascending: true });

    if (year && year !== 'all') {
      const y = parseInt(year);
      query = query.gte('due_date', `${y}-01-01`).lt('due_date', `${y + 1}-01-01`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ obligations: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/dian/obligaciones — crear una obligación
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      year, month, due_date, obligation, formulario, period,
      priority, muisca_section, instructions,
    } = body;

    if (!year || !due_date || !obligation || !formulario) {
      return NextResponse.json(
        { error: 'year, due_date, obligation y formulario son requeridos' },
        { status: 400 }
      );
    }

    const { data, error } = await (atelierTableAdmin('dian_obligations') as any)
      .insert({
        year,
        month: month || '',
        due_date,
        obligation,
        formulario,
        period: period || null,
        priority: priority || 'media',
        muisca_section: muisca_section || null,
        instructions: instructions || null,
        status: 'pendiente',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ obligation: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
