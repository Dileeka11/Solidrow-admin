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
