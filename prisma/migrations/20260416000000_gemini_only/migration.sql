-- Switch default model to Gemini
ALTER TABLE "assistant_instructions"
  ALTER COLUMN "model" SET DEFAULT 'gemini-2.5-flash';

-- Migrate existing rows away from OpenAI models
UPDATE "assistant_instructions"
SET "model" = 'gemini-2.5-flash'
WHERE "model" LIKE 'gpt-%'
   OR "model" LIKE 'o1%'
   OR "model" IS NULL;
