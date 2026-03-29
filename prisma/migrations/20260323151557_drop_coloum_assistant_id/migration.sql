/*
  Warnings:

  - You are about to drop the column `openai_assistant_id` on the `companies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "companies" DROP COLUMN "openai_assistant_id";
