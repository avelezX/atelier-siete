-- =====================================================
-- ATELIER SIETE - MIGRACION 002: JOURNALS Y VOUCHERS
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Fecha: 2026-02-20
-- =====================================================

-- 1. COMPROBANTES CONTABLES (Journals)
-- Contienen costo de ventas (6135), movimientos de inventario, gastos, etc.
CREATE TABLE IF NOT EXISTS atelier_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siigo_id TEXT UNIQUE NOT NULL,
  document_id INTEGER,
  number INTEGER NOT NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  observations TEXT,
  siigo_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atelier_journals_siigo_id ON atelier_journals(siigo_id);
CREATE INDEX IF NOT EXISTS idx_atelier_journals_date ON atelier_journals(date DESC);
CREATE INDEX IF NOT EXISTS idx_atelier_journals_name ON atelier_journals(name);

CREATE TRIGGER update_atelier_journals_updated_at
  BEFORE UPDATE ON atelier_journals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. ITEMS DE COMPROBANTES CONTABLES
-- Cada movimiento contable (debito/credito) con cuenta PUC
CREATE TABLE IF NOT EXISTS atelier_journal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES atelier_journals(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  movement TEXT NOT NULL CHECK (movement IN ('Debit', 'Credit')),
  customer_siigo_id TEXT,
  customer_identification TEXT,
  product_siigo_id TEXT,
  product_code TEXT,
  product_name TEXT,
  product_quantity DECIMAL(15,4),
  description TEXT,
  value DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atelier_journal_items_journal ON atelier_journal_items(journal_id);
CREATE INDEX IF NOT EXISTS idx_atelier_journal_items_account ON atelier_journal_items(account_code);
CREATE INDEX IF NOT EXISTS idx_atelier_journal_items_product ON atelier_journal_items(product_code);

-- 3. VOUCHERS (Recibos de Caja)
CREATE TABLE IF NOT EXISTS atelier_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siigo_id TEXT UNIQUE NOT NULL,
  document_id INTEGER,
  number INTEGER NOT NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT,
  observations TEXT,
  siigo_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atelier_vouchers_siigo_id ON atelier_vouchers(siigo_id);
CREATE INDEX IF NOT EXISTS idx_atelier_vouchers_date ON atelier_vouchers(date DESC);

CREATE TRIGGER update_atelier_vouchers_updated_at
  BEFORE UPDATE ON atelier_vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. ITEMS DE VOUCHERS
CREATE TABLE IF NOT EXISTS atelier_voucher_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES atelier_vouchers(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  movement TEXT NOT NULL CHECK (movement IN ('Debit', 'Credit')),
  customer_siigo_id TEXT,
  customer_identification TEXT,
  description TEXT,
  value DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atelier_voucher_items_voucher ON atelier_voucher_items(voucher_id);
CREATE INDEX IF NOT EXISTS idx_atelier_voucher_items_account ON atelier_voucher_items(account_code);

-- 5. RLS
ALTER TABLE atelier_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE atelier_journal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE atelier_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE atelier_voucher_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON atelier_journals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON atelier_journal_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON atelier_vouchers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON atelier_voucher_items FOR ALL USING (true) WITH CHECK (true);

-- 6. GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON atelier_journals TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON atelier_journal_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON atelier_vouchers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON atelier_voucher_items TO anon, authenticated;

-- 7. VIEW: Costo de ventas por producto (cuenta 6135)
CREATE OR REPLACE VIEW atelier_v_costo_ventas AS
SELECT
  ji.product_code,
  ji.product_name,
  j.date,
  DATE_TRUNC('month', j.date) AS month,
  ji.product_quantity AS quantity,
  ji.value AS cost_value,
  ji.movement,
  ji.account_code,
  j.name AS journal_name,
  p.supplier_name,
  p.is_consignment
FROM atelier_journal_items ji
JOIN atelier_journals j ON j.id = ji.journal_id
LEFT JOIN atelier_products p ON p.code = ji.product_code
WHERE ji.account_code LIKE '6135%'
  AND ji.movement = 'Debit';

GRANT SELECT ON atelier_v_costo_ventas TO anon, authenticated;

-- 8. VIEW: Resumen mensual de gastos por cuenta PUC
CREATE OR REPLACE VIEW atelier_v_gastos_mensuales AS
SELECT
  DATE_TRUNC('month', j.date) AS month,
  ji.account_code,
  CASE
    WHEN ji.account_code LIKE '5105%' THEN 'Nomina'
    WHEN ji.account_code LIKE '5110%' THEN 'Honorarios'
    WHEN ji.account_code LIKE '5115%' THEN 'Impuestos'
    WHEN ji.account_code LIKE '5120%' THEN 'Arrendamientos'
    WHEN ji.account_code LIKE '5135%' THEN 'Servicios'
    WHEN ji.account_code LIKE '5140%' THEN 'Seguros y Mantenimiento'
    WHEN ji.account_code LIKE '5145%' THEN 'Mantenimiento'
    WHEN ji.account_code LIKE '5195%' THEN 'Diversos'
    WHEN ji.account_code LIKE '5205%' THEN 'Gastos Venta - Personal'
    WHEN ji.account_code LIKE '5235%' THEN 'Gastos Venta - Servicios'
    WHEN ji.account_code LIKE '5295%' THEN 'Gastos Venta - Otros'
    WHEN ji.account_code LIKE '5305%' THEN 'Gastos Financieros'
    WHEN ji.account_code LIKE '5315%' THEN 'Gastos Extraordinarios'
    ELSE 'Otro (' || LEFT(ji.account_code, 4) || ')'
  END AS category,
  ji.movement,
  COUNT(*) AS entries,
  SUM(ji.value) AS total_value
FROM atelier_journal_items ji
JOIN atelier_journals j ON j.id = ji.journal_id
WHERE ji.account_code LIKE '5%'
GROUP BY DATE_TRUNC('month', j.date), ji.account_code, ji.movement;

GRANT SELECT ON atelier_v_gastos_mensuales TO anon, authenticated;

-- VERIFICACION
SELECT 'Migracion 002 completada' AS status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'atelier_%' AND table_schema = 'public') AS total_tables;
