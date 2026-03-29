-- CreateTable
CREATE TABLE "company_assets" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" VARCHAR(20) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_assets_company_id_idx" ON "company_assets"("company_id");

-- AddForeignKey
ALTER TABLE "company_assets" ADD CONSTRAINT "company_assets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
