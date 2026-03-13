import { NextRequest, NextResponse } from 'next/server';
import { atelierTableAdmin } from '@/lib/supabase';

// PATCH /api/dian/obligaciones/[id] — actualizar estado, notas, radicado
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const updates: Record<string, any> = {};

    if (body.status !== undefined)           updates.status           = body.status;
    if (body.completion_notes !== undefined) updates.completion_notes = body.completion_notes;
    if (body.radicado !== undefined)         updates.radicado         = body.radicado;
    if (body.completed_at !== undefined)     updates.completed_at     = body.completed_at;
    if (body.instructions !== undefined)     updates.instructions     = body.instructions;
    if (body.muisca_section !== undefined)   updates.muisca_section   = body.muisca_section;
    if (body.priority !== undefined)         updates.priority         = body.priority;

    // Si marca como cumplida y no viene completed_at, poner ahora
    if (body.status === 'cumplida' && !updates.completed_at) {
      updates.completed_at = new Date().toISOString();
    }
    // Si desmarca, limpiar completed_at
    if (body.status === 'pendiente') {
      updates.completed_at = null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
    }

    const { data, error } = await (atelierTableAdmin('dian_obligations') as any)
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ obligation: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/dian/obligaciones/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await (atelierTableAdmin('dian_obligations') as any)
      .delete()
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
