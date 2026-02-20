-- =====================================================
-- ATELIER SIETE - MIGRACION DE BASE DE DATOS (SUPABASE)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Fecha: 2026-02-20
-- =====================================================

-- 0. Helper: trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 1. PROVEEDORES (extraidos del campo reference de productos)
-- =====================================================
CREATE TABLE IF NOT EXISTS atelier_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  commission_pct DECIMAL(5,2),
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atelier_suppliers_name ON atelier_suppliers(name);

CREATE TRIGGER update_atelier_suppliers_updated_at
  BEFORE UPDATE ON atelier_suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. CLIENTES (sincronizados desde Siigo)
-- =====================================================
CREATE TABLE IF NOT EXISTS atelier_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siigo_id TEXT UNIQUE NOT NULL,
  identification TEXT NOT NULL,
  name TEXT NOT NULL,
  commercial_name TEXT,
  person_type TEXT,
  id_type_code TEXT,
  id_type_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city_code TEXT,
  active BOOLEAN DEFAULT TRUE,
  siigo_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atelier_customers_siigo_id ON atelier_customers(siigo_id);
CREATE INDEX IF NOT EXISTS idx_atelier_customers_identification ON atelier_customers(identification);

CREATE TRIGGER update_atelier_customers_updated_at
  BEFORE UPDATE ON atelier_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. PRODUCTOS (sincronizados desde Siigo + costo manual)
-- =====================================================
CREATE TABLE IF NOT EXISTS atelier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siigo_id TEXT UNIQUE NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_group_id INTEGER,
  account_group_name TEXT,
  is_consignment BOOLEAN GENERATED ALWAYS AS (account_group_name = 'Productos en Consignación') STORED,
  type TEXT,
  stock_control BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  tax_classification TEXT,
  tax_included BOOLEAN DEFAULT TRUE,
  tax_percentage DECIMAL(5,2) DEFAULT 19,
  sale_price DECIMAL(15,2),
  sale_price_no_iva DECIMAL(15,2),
  cost DECIMAL(15,2),
  supplier_name TEXT,
  supplier_id UUID REFERENCES atelier_suppliers(id),
  available_quantity INTEGER DEFAULT 0,
  warehouse_name TEXT,
  unit_code TEXT,
  unit_name TEXT,
  siigo_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atelier_products_siigo_id ON atelier_products(siigo_id);
CREATE INDEX IF NOT EXISTS idx_atelier_products_code ON atelier_products(code);
CREATE INDEX IF NOT EXISTS idx_atelier_products_supplier ON atelier_products(supplier_name);
CREATE INDEX IF NOT EXISTS idx_atelier_products_supplier_id ON atelier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_atelier_products_consignment ON atelier_products(is_consignment);
CREATE INDEX IF NOT EXISTS idx_atelier_products_active ON atelier_products(active);

CREATE TRIGGER update_atelier_products_updated_at
  BEFORE UPDATE ON atelier_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. FACTURAS (sincronizadas desde Siigo - encabezado)
-- =====================================================
CREATE TABLE IF NOT EXISTS atelier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siigo_id TEXT UNIQUE NOT NULL,
  document_id INTEGER,
  prefix TEXT,
  number INTEGER NOT NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  customer_siigo_id TEXT,
  customer_identification TEXT,
  customer_name TEXT,
  seller INTEGER,
  currency_code TEXT DEFAULT 'COP',
  subtotal DECIMAL(15,2),
  tax_amount DECIMAL(15,2),
  total DECIMAL(15,2) NOT NULL,
  balance DECIMAL(15,2) DEFAULT 0,
  annulled BOOLEAN DEFAULT FALSE,
  observations TEXT,
  stamp_status TEXT,
  stamp_cufe TEXT,
  payments JSONB,
  retentions JSONB,
  siigo_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atelier_invoices_siigo_id ON atelier_invoices(siigo_id);
CREATE INDEX IF NOT EXISTS idx_atelier_invoices_name ON atelier_invoices(name);
CREATE INDEX IF NOT EXISTS idx_atelier_invoices_date ON atelier_invoices(date DESC);
CREATE INDEX IF NOT EXISTS idx_atelier_invoices_customer ON atelier_invoices(customer_siigo_id);

CREATE TRIGGER update_atelier_invoices_updated_at
  BEFORE UPDATE ON atelier_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. ITEMS DE FACTURA (clave para analisis de costos)
-- =====================================================
CREATE TABLE IF NOT EXISTS atelier_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES atelier_invoices(id) ON DELETE CASCADE,
  siigo_item_id TEXT,
  product_code TEXT NOT NULL,
  description TEXT,
  quantity DECIMAL(15,4) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  discount_pct DECIMAL(5,2) DEFAULT 0,
  tax_id INTEGER,
  tax_name TEXT,
  tax_percentage DECIMAL(5,2),
  tax_value DECIMAL(15,2) DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL,
  product_id UUID REFERENCES atelier_products(id),
  cost_at_sale DECIMAL(15,2),
  margin DECIMAL(15,2),
  margin_pct DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atelier_invoice_items_invoice ON atelier_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_atelier_invoice_items_product_code ON atelier_invoice_items(product_code);
CREATE INDEX IF NOT EXISTS idx_atelier_invoice_items_product_id ON atelier_invoice_items(product_id);

-- =====================================================
-- 6. NOTAS CREDITO (sincronizadas desde Siigo)
-- =====================================================
CREATE TABLE IF NOT EXISTS atelier_credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siigo_id TEXT UNIQUE NOT NULL,
  document_id INTEGER,
  prefix TEXT,
  number INTEGER NOT NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  customer_siigo_id TEXT,
  customer_identification TEXT,
  customer_name TEXT,
  original_invoice_siigo_id TEXT,
  original_invoice_name TEXT,
  subtotal DECIMAL(15,2),
  tax_amount DECIMAL(15,2),
  total DECIMAL(15,2) NOT NULL,
  observations TEXT,
  stamp_status TEXT,
  siigo_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atelier_credit_notes_siigo_id ON atelier_credit_notes(siigo_id);
CREATE INDEX IF NOT EXISTS idx_atelier_credit_notes_date ON atelier_credit_notes(date DESC);

CREATE TRIGGER update_atelier_credit_notes_updated_at
  BEFORE UPDATE ON atelier_credit_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. ITEMS DE NOTAS CREDITO
-- =====================================================
CREATE TABLE IF NOT EXISTS atelier_credit_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID NOT NULL REFERENCES atelier_credit_notes(id) ON DELETE CASCADE,
  siigo_item_id TEXT,
  product_code TEXT NOT NULL,
  description TEXT,
  quantity DECIMAL(15,4) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  tax_id INTEGER,
  tax_name TEXT,
  tax_percentage DECIMAL(5,2),
  tax_value DECIMAL(15,2) DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL,
  product_id UUID REFERENCES atelier_products(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atelier_cn_items_credit_note ON atelier_credit_note_items(credit_note_id);
CREATE INDEX IF NOT EXISTS idx_atelier_cn_items_product_code ON atelier_credit_note_items(product_code);

-- =====================================================
-- 8. LOG DE SINCRONIZACION
-- =====================================================
CREATE TABLE IF NOT EXISTS atelier_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL DEFAULT 'full',
  entity TEXT NOT NULL DEFAULT 'all',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records_fetched INTEGER DEFAULT 0,
  records_upserted INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  error_message TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atelier_sync_log_status ON atelier_sync_log(status);

-- =====================================================
-- 9. ROW LEVEL SECURITY (permisivo por ahora)
-- =====================================================
ALTER TABLE atelier_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE atelier_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE atelier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE atelier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE atelier_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE atelier_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE atelier_credit_note_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE atelier_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON atelier_suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON atelier_customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON atelier_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON atelier_invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON atelier_invoice_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON atelier_credit_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON atelier_credit_note_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON atelier_sync_log FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 10. GRANTS
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON atelier_suppliers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON atelier_customers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON atelier_products TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON atelier_invoices TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON atelier_invoice_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON atelier_credit_notes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON atelier_credit_note_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON atelier_sync_log TO anon, authenticated;

-- =====================================================
-- 11. VIEWS PARA DASHBOARDS
-- =====================================================

-- Ventas por producto
CREATE OR REPLACE VIEW atelier_v_product_sales AS
SELECT
  ii.product_code,
  p.name AS product_name,
  p.supplier_name,
  p.is_consignment,
  p.sale_price,
  p.cost,
  COUNT(DISTINCT ii.invoice_id) AS invoice_count,
  SUM(ii.quantity) AS total_units_sold,
  SUM(ii.line_total) AS total_revenue,
  SUM(ii.unit_price * ii.quantity) AS total_revenue_no_iva,
  CASE WHEN p.cost IS NOT NULL AND p.cost > 0
    THEN SUM(ii.line_total) - (p.cost * SUM(ii.quantity))
    ELSE NULL
  END AS estimated_margin
FROM atelier_invoice_items ii
LEFT JOIN atelier_products p ON p.code = ii.product_code
LEFT JOIN atelier_invoices i ON i.id = ii.invoice_id
WHERE i.annulled = FALSE
GROUP BY ii.product_code, p.name, p.supplier_name, p.is_consignment, p.sale_price, p.cost;

GRANT SELECT ON atelier_v_product_sales TO anon, authenticated;

-- Ventas por proveedor
CREATE OR REPLACE VIEW atelier_v_supplier_sales AS
SELECT
  COALESCE(p.supplier_name, 'SIN PROVEEDOR') AS supplier_name,
  s.commission_pct,
  p.is_consignment,
  COUNT(DISTINCT ii.invoice_id) AS invoice_count,
  COUNT(DISTINCT ii.product_code) AS product_count,
  SUM(ii.quantity) AS total_units_sold,
  SUM(ii.line_total) AS total_revenue,
  CASE WHEN s.commission_pct IS NOT NULL
    THEN ROUND(SUM(ii.line_total) * (1 - s.commission_pct / 100), 2)
    ELSE NULL
  END AS atelier_share,
  CASE WHEN s.commission_pct IS NOT NULL
    THEN ROUND(SUM(ii.line_total) * (s.commission_pct / 100), 2)
    ELSE NULL
  END AS supplier_share
FROM atelier_invoice_items ii
LEFT JOIN atelier_products p ON p.code = ii.product_code
LEFT JOIN atelier_suppliers s ON s.name = p.supplier_name
LEFT JOIN atelier_invoices i ON i.id = ii.invoice_id
WHERE i.annulled = FALSE
GROUP BY p.supplier_name, s.commission_pct, p.is_consignment;

GRANT SELECT ON atelier_v_supplier_sales TO anon, authenticated;

-- Resumen mensual de ventas
CREATE OR REPLACE VIEW atelier_v_monthly_sales AS
SELECT
  DATE_TRUNC('month', i.date) AS month,
  COUNT(*) AS invoice_count,
  SUM(i.total) AS total_sales,
  SUM(i.tax_amount) AS total_tax,
  SUM(i.subtotal) AS total_subtotal,
  COUNT(*) FILTER (WHERE i.balance > 0) AS pending_count,
  SUM(i.balance) AS total_pending
FROM atelier_invoices i
WHERE i.annulled = FALSE
GROUP BY DATE_TRUNC('month', i.date)
ORDER BY month DESC;

GRANT SELECT ON atelier_v_monthly_sales TO anon, authenticated;

-- =====================================================
-- VERIFICACION
-- =====================================================
SELECT 'Migracion completada exitosamente' AS status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'atelier_%' AND table_schema = 'public') AS tables_created;
