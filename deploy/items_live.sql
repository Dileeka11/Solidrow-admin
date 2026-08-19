-- =====================================================================
--  Item master file (under the Accounting / Procurement module)
--  Adds the `items` catalogue table pulled onto PR / PO lines.
--  Run ONCE on the live `solidrow_admin` DB (phpMyAdmin -> SQL tab).
--  No foreign keys (host rejects FK). Idempotent: safe to re-run.
--  Prerequisite: procurement_masters_live.sql has already been run
--  (item_categories must exist for the seed rows below).
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. Item master table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `item_code` varchar(50) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `category_id` bigint(20) unsigned DEFAULT NULL,
  `uom` varchar(30) DEFAULT NULL,
  `unit_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `description` varchar(255) DEFAULT NULL,
  `status` enum('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `items_item_code_unique` (`item_code`),
  KEY `items_category_id_index` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. Seed a few sample items (mapped to existing item categories)
-- ---------------------------------------------------------------------
INSERT IGNORE INTO `items` (`item_code`, `name`, `category_id`, `uom`, `unit_price`, `created_at`, `updated_at`)
SELECT 'STN-001', 'A4 Photocopy Paper (80gsm)', id, 'Box', 2500.00, NOW(), NOW() FROM item_categories WHERE name = 'Stationery';
INSERT IGNORE INTO `items` (`item_code`, `name`, `category_id`, `uom`, `unit_price`, `created_at`, `updated_at`)
SELECT 'STN-002', 'Ballpoint Pen (Blue)', id, 'Pack', 350.00, NOW(), NOW() FROM item_categories WHERE name = 'Stationery';
INSERT IGNORE INTO `items` (`item_code`, `name`, `category_id`, `uom`, `unit_price`, `created_at`, `updated_at`)
SELECT 'IT-001', 'Wireless Mouse', id, 'Pcs', 1800.00, NOW(), NOW() FROM item_categories WHERE name = 'IT Equipment';
INSERT IGNORE INTO `items` (`item_code`, `name`, `category_id`, `uom`, `unit_price`, `created_at`, `updated_at`)
SELECT 'IT-002', 'USB Flash Drive 32GB', id, 'Pcs', 1500.00, NOW(), NOW() FROM item_categories WHERE name = 'IT Equipment';

-- ---------------------------------------------------------------------
-- 3. Record the Laravel migration so `php artisan migrate` won't re-run it.
-- ---------------------------------------------------------------------
INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_19_000001_create_items', 19
WHERE NOT EXISTS (
  SELECT 1 FROM `migrations` WHERE `migration` = '2026_08_19_000001_create_items'
);
