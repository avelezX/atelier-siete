-- =====================================================
-- ATELIER SIETE - MIGRACION 003: FACTURAS DE COMPRA
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Fecha: 2026-02-20
-- =====================================================

-- 1. FACTURAS DE COMPRA (Purchases)
-- Contienen gastos operativos (arriendo, servicios, mercancia, etc.)
CREATE TABLE IF NOT EXISTS atelier_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siigo_id TEXT UNIQUE NOT NULL,
  document_id INTEGER,
  number INTEGER NOT NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  supplier_siigo_id TEXT,
  supplier_identification TEXT,
  supplier_name TEXT,
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  retention_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  balance DECIMAL(15,2) DEFAULT 0,
  provider_invoice_prefix TEXT,
  provider_invoice_number TEXT,
  observations TEXT,
  siigo_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atelier_purchases_siigo_id ON atelier_purchases(siigo_id);
CREATE INDEX IF NOT EXISTS idx_atelier_purchases_date ON atelier_purchases(date DESC);
CREATE INDEX IF NOT EXISTS idx_atelier_purchases_name ON atelier_purchases(name);
CREATE INDEX IF NOT EXISTS idx_atelier_purchases_supplier ON atelier_purchases(supplier_identification);

CREATE TRIGGER update_atelier_purchases_updated_at
  BEFORE UPDATE ON atelier_purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. ITEMS DE FACTURAS DE COMPRA
-- Cada linea con cuenta PUC (5120 arriendo, 6135 mercancia, 5135 servicios, etc.)
CREATE TABLE IF NOT EXISTS atelier_purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES atelier_purchases(id) ON DELETE CASCADE,
  siigo_item_id TEXT,
  account_code TEXT NOT NULL,
  description TEXT,
  quantity DECIMAL(15,4) DEFAULT 1,
  price DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  tax_name TEXT,
  tax_percentage DECIMAL(5,2) DEFAULT 0,
  tax_value DECIMAL(15,2) DEFAULT 0,
  retention_name TEXT,
  retention_percentage DECIMAL(5,2) DEFAULT 0,
  retention_value DECIMAL(15,2) DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atelier_purchase_items_purchase ON atelier_purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_atelier_purchase_items_account ON atelier_purchase_items(account_code);

-- 3. RLS Policies
ALTER TABLE atelier_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE atelier_purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON atelier_purchases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON atelier_purchase_items FOR ALL USING (true) WITH CHECK (true);

-- 4. Grants
GRANT ALL ON atelier_purchases TO service_role;
GRANT ALL ON atelier_purchase_items TO service_role;
GRANT SELECT ON atelier_purchases TO anon, authenticated;
GRANT SELECT ON atelier_purchase_items TO anon, authenticated;
