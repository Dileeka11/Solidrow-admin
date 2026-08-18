-- =====================================================================
--  STAGE 01 — FULL DB UPDATE (Accounting + Procurement) for Solidrow-admin
--  Run ONCE on the live `solidrow_admin` DB (phpMyAdmin -> SQL tab).
--  Combines every change made in this stage, in dependency order:
--    1. Accounting backbone (Chart of Accounts, Journal, permission)
--    2. Procurement masters (Department/Supplier/Category/Bank) + account merge
--    3. Purchase Requisition (PR)
--    4. Purchase Order (PO)
--    5. Goods Received Note (GRN)
--    6. Supplier Payment / Invoice (+ 3-way matching)
--  No foreign keys (host rejects FK). Fully idempotent: safe to re-run.
--  Select the correct DB in phpMyAdmin first (name is not hard-coded).
-- =====================================================================


-- =====================================================================
-- SECTION: accounting_live.sql
-- =====================================================================
-- =====================================================================
--  Accounting module — LIVE install (Chart of Accounts / General Ledger)
--  Run this once in phpMyAdmin (SQL tab) on the live `solidrow_admin` DB.
--  No foreign keys (the host rejects FK, errno 150) — integrity is enforced
--  in the Laravel app layer. Idempotent: safe to run more than once.
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. Tables (exact structure Laravel's migration produces)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `account_categories` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(10) NOT NULL,
  `name` varchar(100) NOT NULL,
  `normal_balance` enum('debit','credit') NOT NULL,
  `statement_type` enum('BS','PNL') NOT NULL DEFAULT 'BS',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `account_categories_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `account_groups` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `category_id` bigint(20) unsigned NOT NULL,
  `code` varchar(10) NOT NULL,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `account_groups_code_unique` (`code`),
  KEY `account_groups_category_id_index` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `accounts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `group_id` bigint(20) unsigned NOT NULL,
  `code` varchar(20) NOT NULL,
  `name` varchar(150) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` varchar(50) NOT NULL DEFAULT 'admin',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_code_unique` (`code`),
  KEY `accounts_group_id_index` (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `journal_entries` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `entry_date` date NOT NULL,
  `posting_date` date DEFAULT NULL,
  `reference` varchar(50) DEFAULT NULL,
  `source_type` varchar(40) DEFAULT NULL,
  `source_id` bigint(20) unsigned DEFAULT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'LKR',
  `branch` varchar(100) DEFAULT NULL,
  `memo` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `journal_entries_source_type_source_id_unique` (`source_type`,`source_id`),
  KEY `journal_entries_entry_date_index` (`entry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `journal_lines` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `entry_id` bigint(20) unsigned NOT NULL,
  `account_id` bigint(20) unsigned NOT NULL,
  `debit` decimal(15,2) NOT NULL DEFAULT 0.00,
  `credit` decimal(15,2) NOT NULL DEFAULT 0.00,
  `memo` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `journal_lines_entry_id_index` (`entry_id`),
  KEY `journal_lines_account_id_index` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. Seed — 5 categories, 8 groups, 10 default accounts
--    (INSERT IGNORE: skips rows that already exist by unique code)
-- ---------------------------------------------------------------------
INSERT IGNORE INTO `account_categories` (`id`,`code`,`name`,`normal_balance`,`statement_type`,`created_at`,`updated_at`) VALUES
  (1,'1000','Assets','debit','BS',NOW(),NOW()),
  (2,'2000','Liabilities','credit','BS',NOW(),NOW()),
  (3,'3000','Equity','credit','BS',NOW(),NOW()),
  (4,'4000','Income','credit','PNL',NOW(),NOW()),
  (5,'5000','Expenses','debit','PNL',NOW(),NOW());

INSERT IGNORE INTO `account_groups` (`id`,`category_id`,`code`,`name`,`created_at`,`updated_at`) VALUES
  (1,1,'1100','Current Assets',NOW(),NOW()),
  (2,1,'1200','Non Current Assets',NOW(),NOW()),
  (3,2,'2100','Current Liabilities',NOW(),NOW()),
  (4,2,'2200','Long Term Liabilities',NOW(),NOW()),
  (5,3,'3100','Owner Equity',NOW(),NOW()),
  (6,4,'4100','Operating Income',NOW(),NOW()),
  (7,5,'5100','Administrative Expenses',NOW(),NOW()),
  (8,5,'5200','Selling Expenses',NOW(),NOW());

INSERT IGNORE INTO `accounts` (`id`,`group_id`,`code`,`name`,`is_active`,`is_default`,`created_by`,`created_at`,`updated_at`) VALUES
  (1,1,'110000','Cash',1,1,'system',NOW(),NOW()),
  (2,1,'110100','Bank',1,1,'system',NOW(),NOW()),
  (3,1,'110200','Trade Receivable',1,1,'system',NOW(),NOW()),
  (4,1,'110300','Inventory',1,1,'system',NOW(),NOW()),
  (5,1,'110400','VAT Input (Recoverable)',1,1,'system',NOW(),NOW()),
  (6,3,'210000','Trade Payable',1,1,'system',NOW(),NOW()),
  (7,3,'210100','VAT Output (Payable)',1,1,'system',NOW(),NOW()),
  (8,6,'410000','Sales Revenue',1,1,'system',NOW(),NOW()),
  (9,7,'510000','Cost of Sales',1,1,'system',NOW(),NOW()),
  (10,8,'520000','Cash Discount Given',1,1,'system',NOW(),NOW());

-- ---------------------------------------------------------------------
-- 3. Permissions — the "Accounting" module (view/add/edit/delete).
--    The admin user gets every permission automatically; grant these to
--    other staff from the User Permissions screen. Unique(module,action)
--    makes INSERT IGNORE safe.
-- ---------------------------------------------------------------------
INSERT IGNORE INTO `permissions` (`module`,`action`,`label`,`sort_order`,`created_at`,`updated_at`) VALUES
  ('Accounting','view','Accounting · View',100,NOW(),NOW()),
  ('Accounting','add','Accounting · Add',101,NOW(),NOW()),
  ('Accounting','edit','Accounting · Edit',102,NOW(),NOW()),
  ('Accounting','delete','Accounting · Delete',103,NOW(),NOW());

-- ---------------------------------------------------------------------
-- 4. Record the migration so `php artisan migrate` never re-creates these
--    tables (only inserts if the row is not already there).
-- ---------------------------------------------------------------------
INSERT INTO `migrations` (`migration`,`batch`)
SELECT '2026_08_18_000001_create_accounting_tables', 17
WHERE NOT EXISTS (
  SELECT 1 FROM `migrations` WHERE `migration` = '2026_08_18_000001_create_accounting_tables'
);


-- =====================================================================
-- SECTION: procurement_masters_live.sql
-- =====================================================================
-- =====================================================================
--  Stage 01 — Procurement masters (under the Accounting module)
--  Adds: Department, Supplier, Category (item) and Bank/Branch masters,
--  plus merges the spec's account codes into the existing Chart of Accounts.
--  Run ONCE on the live `solidrow_admin` DB (phpMyAdmin → SQL tab).
--  No foreign keys (host rejects FK). Idempotent: safe to re-run.
--  Prerequisite: accounting_live.sql has already been run (account_groups
--  must already contain groups 1100/1200/2100/2200/3100/4100/5100/5200).
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. Master tables
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `departments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `status` enum('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `departments_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `contact_person` varchar(255) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `status` enum('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `item_categories` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `item_categories_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `banks` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `banks_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bank_branches` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `bank_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `branch_code` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `bank_branches_bank_id_index` (`bank_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. Seed departments + item categories
-- ---------------------------------------------------------------------
INSERT IGNORE INTO `departments` (`name`, `status`, `created_at`, `updated_at`) VALUES
  ('Solidrow', 'Active', NOW(), NOW()),
  ('RKB', 'Active', NOW(), NOW()),
  ('Travel Tube', 'Active', NOW(), NOW());

INSERT IGNORE INTO `item_categories` (`name`, `created_at`, `updated_at`) VALUES
  ('Stationery', NOW(), NOW()),
  ('IT Equipment', NOW(), NOW()),
  ('Raw Material', NOW(), NOW());

-- ---------------------------------------------------------------------
-- 3. Merge the spec's account codes into the existing Chart of Accounts.
--    Each account is placed under the group whose code matches its type.
--    INSERT IGNORE + unique accounts.code makes this safe to re-run.
-- ---------------------------------------------------------------------
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '1001', 'HNB Bank Account',        1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '1100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '1002', 'Cash in Hand',            1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '1100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '1003', 'Trade Receivables',       1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '1100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '1004', 'Prepayments',             1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '1100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '1005', 'Fixed Assets',            1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '1200';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '5001', 'Inventory / Stock',       1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '1100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '2001', 'Accounts Payable',        1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '2100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '2002', 'Trade Payables',          1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '2100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '2003', 'Accrued Expenses',        1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '2100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '2004', 'Loans',                   1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '2200';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '2005', 'Tax Payable',             1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '2100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '3001', 'Share Capital',           1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '3100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '3002', 'Retained Earnings',       1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '3100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '4001', 'Sales Revenue (Stage 01)', 1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '4100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '4002', 'Other Income',            1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '4100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '5002', 'Office Stationery Expense', 1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '5100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '5003', 'IT Equipment Expense',    1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '5100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '5004', 'Cost of Sales (Stage 01)', 1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '5100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '5005', 'Salaries',                1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '5100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '5006', 'Rent',                    1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '5100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '5007', 'Utilities',               1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '5100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '5008', 'Finance Costs',           1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '5100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '5009', 'Administrative Expenses', 1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '5100';
INSERT IGNORE INTO `accounts` (group_id, code, name, is_active, is_default, created_by, created_at, updated_at)
SELECT id, '5010', 'Selling & Distribution Expenses', 1, 1, 'system', NOW(), NOW() FROM account_groups WHERE code = '5200';

-- ---------------------------------------------------------------------
-- 4. Record the Laravel migration so `php artisan migrate` won't re-create
--    these tables.
-- ---------------------------------------------------------------------
INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_18_000002_create_procurement_masters', 18
WHERE NOT EXISTS (
  SELECT 1 FROM `migrations` WHERE `migration` = '2026_08_18_000002_create_procurement_masters'
);


-- =====================================================================
-- SECTION: pr_live.sql
-- =====================================================================
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


-- =====================================================================
-- SECTION: po_live.sql
-- =====================================================================
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


-- =====================================================================
-- SECTION: grn_live.sql
-- =====================================================================
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


-- =====================================================================
-- SECTION: supplier_payment_live.sql
-- =====================================================================
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

