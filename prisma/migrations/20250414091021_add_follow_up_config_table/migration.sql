-- CreateTable
CREATE TABLE "follow_up_config" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "delay" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "follow_up_config_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "follow_up_config" ADD CONSTRAINT "follow_up_config_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
