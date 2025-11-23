/*
  Warnings:

  - You are about to drop the `smart_followUps` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "smart_followUps";

-- CreateTable
CREATE TABLE "smart_follow_ups" (
    "id" SERIAL NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "contact_id" INTEGER NOT NULL,

    CONSTRAINT "smart_follow_ups_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "smart_follow_ups" ADD CONSTRAINT "smart_follow_ups_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
