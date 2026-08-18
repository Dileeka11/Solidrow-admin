-- =====================================================================
--  Stage 01 — Goods Received Note (GRN)
--  Adds goods_received_notes + grn_items under the Accounting module.
--  Run ONCE on the live `solidrow_admin` DB (phpMyAdmin → SQL tab).
--  No foreign keys (host rejects FK). Idempotent: safe to re-run.
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `goods_received_notes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `grn_number` varchar(30) NOT NULL,
  `grn_date` date NOT NULL,
  `po_id` bigint(20) unsigned NOT NULL,
  `supplier_id` bigint(20) unsigned DEFAULT NULL,
  `delivery_note_no` varchar(100) DEFAULT NULL,
  `received_by` varchar(255) DEFAULT NULL,
  `warehouse` varchar(100) DEFAULT NULL,
  `status` enum('Draft','Confirmed','Partially Matched','Fully Matched') NOT NULL DEFAULT 'Draft',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `goods_received_notes_grn_number_unique` (`grn_number`),
  KEY `goods_received_notes_po_id_index` (`po_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `grn_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `grn_id` bigint(20) unsigned NOT NULL,
  `po_item_id` bigint(20) unsigned DEFAULT NULL,
  `description` varchar(255) NOT NULL,
  `quantity_ordered` decimal(15,2) NOT NULL DEFAULT 0.00,
  `quantity_received` decimal(15,2) NOT NULL DEFAULT 0.00,
  `quantity_accepted` decimal(15,2) NOT NULL DEFAULT 0.00,
  `quantity_rejected` decimal(15,2) NOT NULL DEFAULT 0.00,
  `rejection_reason` varchar(255) DEFAULT NULL,
  `batch_serial_no` varchar(100) DEFAULT NULL,
  `condition` varchar(30) DEFAULT NULL,
  `remarks` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `grn_items_grn_id_index` (`grn_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_18_000005_create_goods_received_notes', 21
WHERE NOT EXISTS (
  SELECT 1 FROM `migrations` WHERE `migration` = '2026_08_18_000005_create_goods_received_notes'
);
