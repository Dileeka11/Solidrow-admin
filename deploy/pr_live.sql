-- =====================================================================
--  Stage 01 — Purchase Requisition (PR)
--  Adds the purchase_requisitions + pr_items tables under the Accounting
--  module. Run ONCE on the live `solidrow_admin` DB (phpMyAdmin → SQL tab).
--  No foreign keys (host rejects FK). Idempotent: safe to re-run.
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `purchase_requisitions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `pr_number` varchar(30) NOT NULL,
  `pr_date` date NOT NULL,
  `requested_by` varchar(255) DEFAULT NULL,
  `department_id` bigint(20) unsigned DEFAULT NULL,
  `priority` enum('Normal','Urgent','Critical') NOT NULL DEFAULT 'Normal',
  `required_date` date DEFAULT NULL,
  `purpose` text DEFAULT NULL,
  `budget_account_id` bigint(20) unsigned DEFAULT NULL,
  `status` enum('Draft','Pending Approval','Approved','Rejected','Converted to PO') NOT NULL DEFAULT 'Draft',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `purchase_requisitions_pr_number_unique` (`pr_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pr_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `pr_id` bigint(20) unsigned NOT NULL,
  `description` varchar(255) NOT NULL,
  `category_id` bigint(20) unsigned DEFAULT NULL,
  `quantity` decimal(15,2) NOT NULL DEFAULT 0.00,
  `uom` varchar(30) DEFAULT NULL,
  `est_unit_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `est_total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `preferred_supplier_id` bigint(20) unsigned DEFAULT NULL,
  `remarks` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `pr_items_pr_id_index` (`pr_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Record the Laravel migration so `php artisan migrate` won't re-create these.
INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_18_000003_create_purchase_requisitions', 19
WHERE NOT EXISTS (
  SELECT 1 FROM `migrations` WHERE `migration` = '2026_08_18_000003_create_purchase_requisitions'
);
