/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `User`;

-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `name` VARCHAR(512) NOT NULL,
    `password` VARCHAR(256) NOT NULL,
    `is_admin` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `user_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `publisher` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(128) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `author` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(128) NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `book` (
    `isbn` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(512) NOT NULL,
    `author_id` VARCHAR(36) NOT NULL,
    `publisher_id` VARCHAR(36) NOT NULL,
    `publication_year` INTEGER UNSIGNED NOT NULL,
    `publication_month` TINYINT UNSIGNED NOT NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `book_isbn_key`(`isbn`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rental_log` (
    `id` VARCHAR(36) NOT NULL,
    `book_isbn` BIGINT UNSIGNED NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `checkout_date` DATETIME(0) NOT NULL,
    `due_date` DATETIME(0) NOT NULL,
    `returned_date` DATETIME(0) NOT NULL,

    UNIQUE INDEX `rental_log_book_isbn_key`(`book_isbn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
