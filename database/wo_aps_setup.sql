-- Workshop Work Order System - Database setup for XAMPP
CREATE DATABASE IF NOT EXISTS wo_aps CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wo_aps;

-- Run Laravel migrations for full schema:
-- cd backend && php artisan migrate --seed
