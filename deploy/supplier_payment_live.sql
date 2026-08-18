-- =====================================================================
--  Stage 01 — Supplier Payment / Invoice (+ 3-way matching)
--  Adds supplier_invoices + supplier_invoice_items under the Accounting
--  module. Run ONCE on the live `solidrow_admin` DB (phpMyAdmin → SQL tab).
--  No foreign keys (host rejects FK). Idempotent: safe to re-run.
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `supplier_invoices` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `internal_ref_no` varchar(30) NOT NULL,
  `supplier_invoice_no` varchar(100) DEFAULT NULL,
  `invoice_date` date NOT NULL,
  `po_id` bigint(20) unsigned DEFAULT NULL,
  `grn_ids` longtext DEFAULT NULL,
  `supplier_id` bigint(20) unsigned DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'LKR',
  `attached_document` varchar(255) DEFAULT NULL,
  `status` enum('Draft','Pending Matching','Matched','Disputed','Approved for Payment','Paid') NOT NULL DEFAULT 'Draft',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `supplier_invoices_internal_ref_no_unique` (`internal_ref_no`),
  KEY `supplier_invoices_po_id_index` (`po_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `supplier_invoice_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` bigint(20) unsigned NOT NULL,
  `po_item_id` bigint(20) unsigned DEFAULT NULL,
  `description` varchar(255) NOT NULL,
  `quantity_invoiced` decimal(15,2) NOT NULL DEFAULT 0.00,
  `unit_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `tax_pct` decimal(5,2) NOT NULL DEFAULT 0.00,
  `line_total` decimal(15,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `supplier_invoice_items_invoice_id_index` (`invoice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_18_000006_create_supplier_invoices', 22
WHERE NOT EXISTS (
  SELECT 1 FROM `migrations` WHERE `migration` = '2026_08_18_000006_create_supplier_invoices'
);
