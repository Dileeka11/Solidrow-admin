-- =====================================================================
--  Stage 01 — Purchase Order (PO)
--  Adds purchase_orders + po_items under the Accounting module.
--  Run ONCE on the live `solidrow_admin` DB (phpMyAdmin → SQL tab).
--  No foreign keys (host rejects FK). Idempotent: safe to re-run.
--  (source_pr_ids stored as JSON text; no CHECK constraint for max
--   compatibility with older MySQL/MariaDB.)
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `po_number` varchar(30) NOT NULL,
  `po_date` date NOT NULL,
  `supplier_id` bigint(20) unsigned DEFAULT NULL,
  `delivery_address` text DEFAULT NULL,
  `payment_terms` varchar(50) DEFAULT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'LKR',
  `expected_delivery_date` date DEFAULT NULL,
  `source_pr_ids` longtext DEFAULT NULL,
  `status` enum('Draft','Pending Approval','Approved','Sent to Supplier','Partially Received','Fully Received','Closed','Cancelled') NOT NULL DEFAULT 'Draft',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `purchase_orders_po_number_unique` (`po_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `po_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `po_id` bigint(20) unsigned NOT NULL,
  `description` varchar(255) NOT NULL,
  `category_id` bigint(20) unsigned DEFAULT NULL,
  `quantity_ordered` decimal(15,2) NOT NULL DEFAULT 0.00,
  `uom` varchar(30) DEFAULT NULL,
  `unit_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount_pct` decimal(5,2) NOT NULL DEFAULT 0.00,
  `tax_pct` decimal(5,2) NOT NULL DEFAULT 0.00,
  `line_total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `quantity_received` decimal(15,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `po_items_po_id_index` (`po_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_18_000004_create_purchase_orders', 20
WHERE NOT EXISTS (
  SELECT 1 FROM `migrations` WHERE `migration` = '2026_08_18_000004_create_purchase_orders'
);
