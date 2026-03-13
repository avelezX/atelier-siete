"""
Siembra las obligaciones tributarias 2026 de Atelier Siete
en la tabla atelier_dian_obligations de Supabase.

Régimen Común — NIT 901.764.924-4 — Dígito NIT: 4
Fuente: Calendario Tributario DIAN (Decreto 2229/2023)

Uso:
  python scripts/seed_obligations_2026.py           # insertar
  python scripts/seed_obligations_2026.py --delete  # eliminar año 2026 y 2027
"""

import os
import sys
from pathlib import Path

# ── Cargar .env.local ─────────────────────────────────────────────────────────
env_path = Path(__file__).parent.parent / '.env.local'
if env_path.exists():
    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, _, val = line.partition('=')
            os.environ.setdefault(key.strip(), val.strip())

try:
    from supabase import create_client
except ImportError:
    print('ERROR: supabase-py no instalado.')
    print('Ejecutar:  pip install supabase')
    sys.exit(1)

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print('ERROR: No se encontraron NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local')
    sys.exit(1)

client = create_client(SUPABASE_URL, SUPABASE_KEY)
TABLE = 'atelier_dian_obligations'

# ── Datos ──────────────────────────────────────────────────────────────────────

OBLIGATIONS = [

    # ══════════════════════════════════════════════════════════════════════════
    # ENERO 2026 — VENCIDAS (requieren pago urgente con F-490)
    # ══════════════════════════════════════════════════════════════════════════
    {
        'year': 2026, 'month': 'ENERO 2026', 'due_date': '2026-01-18',
        'obligation': 'IVA Cuatrimestral (Sep–Dic 2025) — DECLARACIÓN Y PAGO PENDIENTE',
        'formulario': 'F-300', 'period': 'Sep–Dic 2025',
        'priority': 'critica', 'status': 'pendiente',
        'instructions': (
            'VENCIDA desde el 18 de enero de 2026.\n'
            'Genera intereses de mora desde esa fecha.\n'
            '1. Diligenciar F-300 en MUISCA.\n'
            '2. Pagar con F-490 (incluir intereses de mora).\n'
            'Contactar contador de inmediato.'
        ),
    },
    {
        'year': 2026, 'month': 'ENERO 2026', 'due_date': '2026-01-18',
        'obligation': 'Retención en la Fuente (Dic 2025) — DECLARACIÓN Y PAGO PENDIENTE',
        'formulario': 'F-350', 'period': 'Dic 2025',
        'priority': 'critica', 'status': 'pendiente',
        'instructions': (
            'VENCIDA desde el 18 de enero de 2026.\n'
            'Genera intereses de mora desde esa fecha.\n'
            '1. Diligenciar F-350 en MUISCA.\n'
            '2. Pagar con F-490 (incluir intereses de mora).\n'
            'Contactar contador de inmediato.'
        ),
    },

    # ══════════════════════════════════════════════════════════════════════════
    # FEBRERO 2026 — Verificar
    # ══════════════════════════════════════════════════════════════════════════
    {
        'year': 2026, 'month': 'FEBRERO 2026', 'due_date': '2026-02-13',
        'obligation': 'Retención en la Fuente — ene 2026',
        'formulario': 'F-350', 'period': 'Ene 2026',
        'priority': 'critica', 'status': 'verificar',
        'instructions': (
            'Verificar si fue declarada y pagada antes del 13 de febrero de 2026.\n'
            'Si NO se cumplió: regularizar con F-350 + F-490 (con intereses de mora).'
        ),
    },

    # ══════════════════════════════════════════════════════════════════════════
    # MARZO 2026
    # ══════════════════════════════════════════════════════════════════════════
    {
        'year': 2026, 'month': 'MARZO 2026', 'due_date': '2026-03-13',
        'obligation': 'Retención en la Fuente — feb 2026',
        'formulario': 'F-350', 'period': 'Feb 2026',
        'priority': 'critica', 'status': 'pendiente',
        'instructions': (
            'Declarar y pagar retenciones practicadas en febrero 2026.\n'
            '1. Diligenciar F-350 en MUISCA.\n'
            '2. Pagar con F-490.'
        ),
    },

    # ══════════════════════════════════════════════════════════════════════════
    # ABRIL 2026
    # ══════════════════════════════════════════════════════════════════════════
    {
        'year': 2026, 'month': 'ABRIL 2026', 'due_date': '2026-04-16',
        'obligation': 'Retención en la Fuente — mar 2026',
        'formulario': 'F-350', 'period': 'Mar 2026',
        'priority': 'critica', 'status': 'pendiente',
        'instructions': (
            'Declarar y pagar retenciones practicadas en marzo 2026.\n'
            '1. Diligenciar F-350 en MUISCA.\n'
            '2. Pagar con F-490.'
        ),
    },

    # ══════════════════════════════════════════════════════════════════════════
    # MAYO 2026
    # ══════════════════════════════════════════════════════════════════════════
    {
        'year': 2026, 'month': 'MAYO 2026', 'due_date': '2026-05-15',
        'obligation': 'Declaración de Renta + Pago 1a. cuota (Personas jurídicas, AG 2025)',
        'formulario': 'F-110', 'period': 'Año Gravable 2025',
        'priority': 'critica', 'status': 'pendiente',
        'instructions': (
            'Presentar declaración de renta AG 2025 y pagar la 1a. cuota.\n'
            'Personas jurídicas NO grandes contribuyentes declaran en 2 cuotas.\n'
            '1. Preparar estados financieros 2025 con el contador.\n'
            '2. Diligenciar F-110 en MUISCA.\n'
            '3. Pagar 1a. cuota con F-490.\n'
            'La 2a. cuota vence el 14 de julio de 2026.'
        ),
    },
    {
        'year': 2026, 'month': 'MAYO 2026', 'due_date': '2026-05-15',
        'obligation': 'IVA Cuatrimestral — Ene–Abr 2026 Declaración y pago',
        'formulario': 'F-300', 'period': 'Ene–Abr 2026',
        'priority': 'critica', 'status': 'pendiente',
        'instructions': (
            'Declarar y pagar IVA del cuatrimestre enero–abril 2026.\n'
            'Aplica porque ingresos son inferiores a 92.000 UVT.\n'
            '1. Diligenciar F-300 en MUISCA.\n'
            '2. Pagar con F-490.'
        ),
    },
    {
        'year': 2026, 'month': 'MAYO 2026', 'due_date': '2026-05-15',
        'obligation': 'Retención en la Fuente — abr 2026',
        'formulario': 'F-350', 'period': 'Abr 2026',
        'priority': 'critica', 'status': 'pendiente',
        'instructions': (
            'Declarar y pagar retenciones practicadas en abril 2026.\n'
            '1. Diligenciar F-350 en MUISCA.\n'
            '2. Pagar con F-490.'
        ),
    },

    # ══════════════════════════════════════════════════════════════════════════
    # JUNIO 2026
    # ══════════════════════════════════════════════════════════════════════════
    {
        'year': 2026, 'month': 'JUNIO 2026', 'due_date': '2026-06-16',
        'obligation': 'Retención en la Fuente — may 2026',
        'formulario': 'F-350', 'period': 'May 2026',
        'priority': 'critica', 'status': 'pendiente',
        'instructions': (
            'Declarar y pagar retenciones practicadas en mayo 2026.\n'
            '1. Diligenciar F-350 en MUISCA.\n'
            '2. Pagar con F-490.'
        ),
    },

    # ══════════════════════════════════════════════════════════════════════════
    # JULIO 2026
    # ══════════════════════════════════════════════════════════════════════════
    {
        'year': 2026, 'month': 'JULIO 2026', 'due_date': '2026-07-14',
        'obligation': 'Renta — Pago 2a. cuota (AG 2025)',
        'formulario': 'F-110', 'period': 'Año Gravable 2025',
        'priority': 'critica', 'status': 'pendiente',
        'instructions': (
            'Pago de la segunda cuota de la declaración de renta AG 2025.\n'
            'La declaración fue presentada en mayo 2026.\n'
            '1. Calcular saldo de la 2a. cuota con el contador.\n'
            '2. Pagar con F-490.'
        ),
    },
    {
        'year': 2026, 'month': 'JULIO 2026', 'due_date': '2026-07-14',
        'obligation': 'Retención en la Fuente — jun 2026',
        'formulario': 'F-350', 'period': 'Jun 2026',
        'priority': 'critica', 'status': 'pendiente',
        'instructions': (
            'Declarar y pagar retenciones practicadas en junio 2026.\n'
            '1. Diligenciar F-350 en MUISCA.\n'
            '2. Pagar con F-490.'
        ),
    },

    # ══════════════════════════════════════════════════════════════════════════
    # AGOSTO 2026
    # ══════════════════════════════════════════════════════════════════════════
    {
        'year': 2026, 'month': 'AGOSTO 2026', 'due_date': '2026-08-18',
        'obligation': 'Retención en la Fuente — jul 2026',
        'formulario': 'F-350', 'period': 'Jul 2026',
        'priority': 'critica', 'status': 'pendiente',
        'instructions': (
            'Declarar y pagar retenciones practicadas en julio 2026.\n'
            '1. Diligenciar F-350 en MUISCA.\n'
            '2. Pagar con F-490.'
        ),
    },

    # ══════════════════════════════════════════════════════════════════════════
    # SEPTIEMBRE 2026
    # ══════════════════════════════════════════════════════════════════════════
    {
        'year': 2026, 'month': 'SEPTIEMBRE 2026', 'due_date': '2026-09-14',
        'obligation': 'IVA Cuatrimestral — May–Ago 2026 Declaración y pago',
        'formulario': 'F-300', 'period': 'May–Ago 2026',
        'priority': 'critica', 'status': 'pendiente',
        'instructions': (
            'Declarar y pagar IVA del cuatrimestre mayo–agosto 2026.\n'
            '1. Diligenciar F-300 en MUISCA.\n'
            '2. Pagar con F-490.'
        ),
    },
    {
        'year': 2026, 'month': 'SEPTIEMBRE 2026', 'due_date': '2026-09-14',
        'obligation': 'Retención en la Fuente — ago 2026',
        'formulario': 'F-350', 'period': 'Ago 2026',
        'priority': 'critica', 'status': 'pendiente',
        'instructions': (
            'Declarar y pagar retenciones practicadas en agosto 2026.\n'
            '1. Diligenciar F-350 en MUISCA.\n'
            '2. Pagar con F-490.'
        ),
    },

    # ══════════════════════════════════════════════════════════════════════════
    # OCTUBRE 2026
    # ══════════════════════════════════════════════════════════════════════════
    {
        'year': 2026, 'month': 'OCTUBRE 2026', 'due_date': '2026-10-15',
        'obligation': 'Retención en la Fuente — sep 2026',
        'formulario': 'F-350', 'period': 'Sep 2026',
        'priority': 'critica', 'status': 'pendiente',
        'instructions': (
            'Declarar y pagar retenciones practicadas en septiembre 2026.\n'
            '1. Diligenciar F-350 en MUISCA.\n'
            '2. Pagar con F-490.'
        ),
    },

    # ══════════════════════════════════════════════════════════════════════════
    # NOVIEMBRE 2026
    # ══════════════════════════════════════════════════════════════════════════
    {
        'year': 2026, 'month': 'NOVIEMBRE 2026', 'due_date': '2026-11-17',
        'obligation': 'Retención en la Fuente — oct 2026',
        'formulario': 'F-350', 'period': 'Oct 2026',
        'priority': 'critica', 'status': 'pendiente',
        'instructions': (
            'Declarar y pagar retenciones practicadas en octubre 2026.\n'
            '1. Diligenciar F-350 en MUISCA.\n'
            '2. Pagar con F-490.'
        ),
    },

    # ══════════════════════════════════════════════════════════════════════════
    # DICIEMBRE 2026
    # ══════════════════════════════════════════════════════════════════════════
    {
        'year': 2026, 'month': 'DICIEMBRE 2026', 'due_date': '2026-12-15',
        'obligation': 'Retención en la Fuente — nov 2026',
        'formulario': 'F-350', 'period': 'Nov 2026',
        'priority': 'critica', 'status': 'pendiente',
        'instructions': (
            'Declarar y pagar retenciones practicadas en noviembre 2026.\n'
            '1. Diligenciar F-350 en MUISCA.\n'
            '2. Pagar con F-490.'
        ),
    },

    # ══════════════════════════════════════════════════════════════════════════
    # ENERO 2027
    # ══════════════════════════════════════════════════════════════════════════
    {
        'year': 2027, 'month': 'ENERO 2027', 'due_date': '2027-01-18',
        'obligation': 'IVA Cuatrimestral — Sep–Dic 2026 Declaración y pago',
        'formulario': 'F-300', 'period': 'Sep–Dic 2026',
        'priority': 'critica', 'status': 'pendiente',
        'instructions': (
            'Declarar y pagar IVA del cuatrimestre septiembre–diciembre 2026.\n'
            '1. Diligenciar F-300 en MUISCA.\n'
            '2. Pagar con F-490.'
        ),
    },
    {
        'year': 2027, 'month': 'ENERO 2027', 'due_date': '2027-01-18',
        'obligation': 'Retención en la Fuente — dic 2026',
        'formulario': 'F-350', 'period': 'Dic 2026',
        'priority': 'critica', 'status': 'pendiente',
        'instructions': (
            'Declarar y pagar retenciones practicadas en diciembre 2026.\n'
            '1. Diligenciar F-350 en MUISCA.\n'
            '2. Pagar con F-490.'
        ),
    },
]


# ── Funciones ─────────────────────────────────────────────────────────────────

def seed():
    print(f'Insertando {len(OBLIGATIONS)} obligaciones...')
    result = client.table(TABLE).insert(OBLIGATIONS).execute()
    if hasattr(result, 'error') and result.error:
        print(f'ERROR: {result.error}')
        return
    print(f'✓ {len(OBLIGATIONS)} obligaciones insertadas correctamente.')
    print()
    print('Resumen:')
    print('  • 2 obligaciones VENCIDAS (ene 2026) — atención urgente')
    print('  • 1 obligación en VERIFICAR (feb 2026)')
    print('  • 16 obligaciones PENDIENTES (mar 2026 – ene 2027)')
    print()
    print('Ve a /dian/obligaciones para verlas en el calendario.')
    print('Para eliminar: python scripts/seed_obligations_2026.py --delete')


def delete():
    print('Eliminando obligaciones de 2026 y 2027...')
    client.table(TABLE).delete().eq('year', 2026).execute()
    client.table(TABLE).delete().eq('year', 2027).execute()
    print('✓ Obligaciones eliminadas.')


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    if '--delete' in sys.argv:
        delete()
    else:
        seed()
