-- =====================================================
-- ATELIER SIETE - MIGRACION 004: TIPO DE ITEM EN COMPRAS
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Fecha: 2026-03-09
-- =====================================================

-- Agrega item_type ('Product', 'Account', 'FixedAsset') y product_code a purchase_items
-- Esto permite clasificar compras de inventario propio vs consignación
-- cruzando product_code con products.code → products.is_consignment

ALTER TABLE atelier_purchase_items ADD COLUMN IF NOT EXISTS item_type TEXT;
ALTER TABLE atelier_purchase_items ADD COLUMN IF NOT EXISTS product_code TEXT;

CREATE INDEX IF NOT EXISTS idx_atelier_purchase_items_type ON atelier_purchase_items(item_type);
CREATE INDEX IF NOT EXISTS idx_atelier_purchase_items_product_code ON atelier_purchase_items(product_code);
