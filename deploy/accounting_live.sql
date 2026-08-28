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
  `parent_id` bigint(20) unsigned DEFAULT NULL,
  `code` varchar(20) NOT NULL,
  `name` varchar(150) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` varchar(50) NOT NULL DEFAULT 'admin',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accounts_code_unique` (`code`),
  KEY `accounts_group_id_index` (`group_id`),
  KEY `accounts_parent_id_index` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Existing installs: add the tree column + index if they aren't there yet.
-- (Guarded so it's safe on MySQL, which lacks ADD COLUMN IF NOT EXISTS.)
SET @has_parent := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'parent_id');
SET @sql := IF(@has_parent = 0,
  'ALTER TABLE `accounts` ADD COLUMN `parent_id` bigint(20) unsigned DEFAULT NULL AFTER `group_id`, ADD KEY `accounts_parent_id_index` (`parent_id`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

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

INSERT INTO `migrations` (`migration`,`batch`)
SELECT '2026_08_28_000001_add_parent_to_accounts', 17
WHERE NOT EXISTS (
  SELECT 1 FROM `migrations` WHERE `migration` = '2026_08_28_000001_add_parent_to_accounts'
);
