-- ============================================================
-- CALENDARIO TRIBUTARIO 2026 — ATELIER SIETE
-- NIT 901.764.924 | Régimen Común | Dígito NIT: 4
-- Fuente: Calendario Tributario DIAN (Decreto 2229/2023)
--
-- Ejecutar en Supabase SQL Editor
-- ============================================================

INSERT INTO atelier_dian_obligations
  (year, month, due_date, obligation, formulario, period, priority, status, instructions)
VALUES

-- ── ENERO 2026 ─────────────────────────────────────────────
(2026, 'ENERO 2026',    '2026-01-18',
 'IVA Cuatrimestral (Sep–Dic 2025) — DECLARACIÓN Y PAGO PENDIENTE',
 'F-300', 'Sep–Dic 2025', 'critica', 'pendiente',
 'VENCIDA. Declarar y pagar a la mayor brevedad con F-490. Genera intereses de mora desde el 18 de enero de 2026.'),

(2026, 'ENERO 2026',    '2026-01-18',
 'Retención en la Fuente (Dic 2025) — DECLARACIÓN Y PAGO PENDIENTE',
 'F-350', 'Dic 2025', 'critica', 'pendiente',
 'VENCIDA. Declarar y pagar a la mayor brevedad con F-490. Genera intereses de mora desde el 18 de enero de 2026.'),

-- ── FEBRERO 2026 ───────────────────────────────────────────
(2026, 'FEBRERO 2026',  '2026-02-13',
 'Retención en la Fuente — ene 2026',
 'F-350', 'Ene 2026', 'critica', 'verificar',
 'Verificar si fue declarada y pagada antes del 13 de febrero de 2026. Si no se cumplió, regularizar con F-490.'),

-- ── MARZO 2026 ─────────────────────────────────────────────
(2026, 'MARZO 2026',    '2026-03-13',
 'Retención en la Fuente — feb 2026',
 'F-350', 'Feb 2026', 'critica', 'pendiente',
 'Declarar y pagar retenciones practicadas en febrero 2026. Pagar con F-490.'),

-- ── ABRIL 2026 ─────────────────────────────────────────────
(2026, 'ABRIL 2026',    '2026-04-16',
 'Retención en la Fuente — mar 2026',
 'F-350', 'Mar 2026', 'critica', 'pendiente',
 'Declarar y pagar retenciones practicadas en marzo 2026. Pagar con F-490.'),

-- ── MAYO 2026 ──────────────────────────────────────────────
(2026, 'MAYO 2026',     '2026-05-15',
 'Declaración de Renta + Pago 1a. cuota (Personas jurídicas, AG 2025)',
 'F-110', 'Año Gravable 2025', 'critica', 'pendiente',
 'Presentar declaración de renta AG 2025 y pagar la 1a. cuota. Personas jurídicas no grandes contribuyentes declaran en 2 cuotas. 2a cuota vence en julio.'),

(2026, 'MAYO 2026',     '2026-05-15',
 'IVA Cuatrimestral — Ene–Abr 2026 Declaración y pago',
 'F-300', 'Ene–Abr 2026', 'critica', 'pendiente',
 'Declarar y pagar IVA del cuatrimestre enero–abril 2026. Pagar con F-490. Aplica porque ingresos son inferiores a 92.000 UVT.'),

(2026, 'MAYO 2026',     '2026-05-15',
 'Retención en la Fuente — abr 2026',
 'F-350', 'Abr 2026', 'critica', 'pendiente',
 'Declarar y pagar retenciones practicadas en abril 2026. Pagar con F-490.'),

-- ── JUNIO 2026 ─────────────────────────────────────────────
(2026, 'JUNIO 2026',    '2026-06-16',
 'Retención en la Fuente — may 2026',
 'F-350', 'May 2026', 'critica', 'pendiente',
 'Declarar y pagar retenciones practicadas en mayo 2026. Pagar con F-490.'),

-- ── JULIO 2026 ─────────────────────────────────────────────
(2026, 'JULIO 2026',    '2026-07-14',
 'Renta — Pago 2a. cuota (AG 2025)',
 'F-110', 'Año Gravable 2025', 'critica', 'pendiente',
 'Pago de la segunda cuota de la declaración de renta AG 2025. La declaración fue presentada en mayo.'),

(2026, 'JULIO 2026',    '2026-07-14',
 'Retención en la Fuente — jun 2026',
 'F-350', 'Jun 2026', 'critica', 'pendiente',
 'Declarar y pagar retenciones practicadas en junio 2026. Pagar con F-490.'),

-- ── AGOSTO 2026 ────────────────────────────────────────────
(2026, 'AGOSTO 2026',   '2026-08-18',
 'Retención en la Fuente — jul 2026',
 'F-350', 'Jul 2026', 'critica', 'pendiente',
 'Declarar y pagar retenciones practicadas en julio 2026. Pagar con F-490.'),

-- ── SEPTIEMBRE 2026 ────────────────────────────────────────
(2026, 'SEPTIEMBRE 2026', '2026-09-14',
 'IVA Cuatrimestral — May–Ago 2026 Declaración y pago',
 'F-300', 'May–Ago 2026', 'critica', 'pendiente',
 'Declarar y pagar IVA del cuatrimestre mayo–agosto 2026. Pagar con F-490.'),

(2026, 'SEPTIEMBRE 2026', '2026-09-14',
 'Retención en la Fuente — ago 2026',
 'F-350', 'Ago 2026', 'critica', 'pendiente',
 'Declarar y pagar retenciones practicadas en agosto 2026. Pagar con F-490.'),

-- ── OCTUBRE 2026 ───────────────────────────────────────────
(2026, 'OCTUBRE 2026',  '2026-10-15',
 'Retención en la Fuente — sep 2026',
 'F-350', 'Sep 2026', 'critica', 'pendiente',
 'Declarar y pagar retenciones practicadas en septiembre 2026. Pagar con F-490.'),

-- ── NOVIEMBRE 2026 ─────────────────────────────────────────
(2026, 'NOVIEMBRE 2026', '2026-11-17',
 'Retención en la Fuente — oct 2026',
 'F-350', 'Oct 2026', 'critica', 'pendiente',
 'Declarar y pagar retenciones practicadas en octubre 2026. Pagar con F-490.'),

-- ── DICIEMBRE 2026 ─────────────────────────────────────────
(2026, 'DICIEMBRE 2026', '2026-12-15',
 'Retención en la Fuente — nov 2026',
 'F-350', 'Nov 2026', 'critica', 'pendiente',
 'Declarar y pagar retenciones practicadas en noviembre 2026. Pagar con F-490.'),

-- ── ENERO 2027 ─────────────────────────────────────────────
(2027, 'ENERO 2027',    '2027-01-18',
 'IVA Cuatrimestral — Sep–Dic 2026 Declaración y pago',
 'F-300', 'Sep–Dic 2026', 'critica', 'pendiente',
 'Declarar y pagar IVA del cuatrimestre septiembre–diciembre 2026. Pagar con F-490.'),

(2027, 'ENERO 2027',    '2027-01-18',
 'Retención en la Fuente — dic 2026',
 'F-350', 'Dic 2026', 'critica', 'pendiente',
 'Declarar y pagar retenciones practicadas en diciembre 2026. Pagar con F-490.');
