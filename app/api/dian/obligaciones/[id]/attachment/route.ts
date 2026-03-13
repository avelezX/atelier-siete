import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, atelierTableAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

const BUCKET = 'atelier-siete';

type AttachmentEntry = { name: string; path: string };

// POST /api/dian/obligaciones/[id]/attachment — agregar comprobante
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'Archivo muy grande (max 20MB)' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const storagePath = `dian/obligaciones/${params.id}/${file.name}`;

    const { error: storageError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      });

    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 });
    }

    const { data: ob } = await (atelierTableAdmin('dian_obligations') as any)
      .select('attachments')
      .eq('id', params.id)
      .single();

    const current: AttachmentEntry[] = ob?.attachments || [];
    const updated: AttachmentEntry[] = [
      ...current.filter(a => a.name !== file.name),
      { name: file.name, path: storagePath },
    ];

    const { data, error: dbError } = await (atelierTableAdmin('dian_obligations') as any)
      .update({ attachments: updated })
      .eq('id', params.id)
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ attachments: updated, obligation: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/dian/obligaciones/[id]/attachment — obtener URL firmada
// ?name=filename  → URL de un adjunto específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: ob, error: dbError } = await (atelierTableAdmin('dian_obligations') as any)
      .select('attachments')
      .eq('id', params.id)
      .single();

    if (dbError || !ob) {
      return NextResponse.json({ error: 'Obligación no encontrada' }, { status: 404 });
    }

    const attachments: AttachmentEntry[] = ob.attachments || [];

    if (attachments.length === 0) {
      return NextResponse.json({ attachments: [] });
    }

    const withUrls = await Promise.all(
      attachments.map(async (att) => {
        const { data: urlData } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(att.path, 60 * 60);
        return { ...att, url: urlData?.signedUrl ?? null };
      })
    );

    const specificName = request.nextUrl.searchParams.get('name');
    if (specificName) {
      const found = withUrls.find(a => a.name === specificName);
      if (!found) return NextResponse.json({ error: 'Adjunto no encontrado' }, { status: 404 });
      return NextResponse.json({ url: found.url, name: found.name });
    }

    return NextResponse.json({ attachments: withUrls });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/dian/obligaciones/[id]/attachment?name=filename
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: ob } = await (atelierTableAdmin('dian_obligations') as any)
      .select('attachments')
      .eq('id', params.id)
      .single();

    const current: AttachmentEntry[] = ob?.attachments || [];
    const fileName = request.nextUrl.searchParams.get('name');

    let updated: AttachmentEntry[];

    if (fileName) {
      const toDelete = current.find(a => a.name === fileName);
      if (toDelete) {
        await supabaseAdmin.storage.from(BUCKET).remove([toDelete.path]);
      }
      updated = current.filter(a => a.name !== fileName);
    } else {
      if (current.length > 0) {
        await supabaseAdmin.storage.from(BUCKET).remove(current.map(a => a.path));
      }
      updated = [];
    }

    const { error } = await (atelierTableAdmin('dian_obligations') as any)
      .update({ attachments: updated })
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, attachments: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
