-- CreateTable
CREATE TABLE "smart_followUps" (
    "id" SERIAL NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,

    CONSTRAINT "smart_followUps_pkey" PRIMARY KEY ("id")
);
