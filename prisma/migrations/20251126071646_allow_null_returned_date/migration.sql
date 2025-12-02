/*
  Warnings:

  - Made the column `returned_date` on table `rental_log` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `rental_log` MODIFY `returned_date` DATETIME(0) NOT NULL;
