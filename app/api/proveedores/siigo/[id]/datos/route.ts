import { NextRequest, NextResponse } from 'next/server';
import { fetchAllCustomers } from '@/lib/siigo';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const allCustomers = await fetchAllCustomers();
    const match = allCustomers.find(c => c.id === id);

    if (!match) return NextResponse.json({ id, nombre: '', siigo: null });

    return NextResponse.json({
      id,
      nombre: match.name?.join(' ') || '',
      siigo: {
        identification: match.identification,
        person_type: match.person_type,
        id_type: (match.id_type as any)?.name || match.id_type,
        active: match.active,
        vat_responsible: match.vat_responsible,
        direccion: match.address?.address,
        telefonos: match.phones?.map((p: any) => p.number).join(', '),
        contactos: match.contacts?.map((c: any) => ({
          nombre: `${c.first_name} ${c.last_name}`.trim(),
          email: c.email,
        })),
      },
    });
  } catch {
    return NextResponse.json({ id, nombre: '', siigo: null });
  }
}
