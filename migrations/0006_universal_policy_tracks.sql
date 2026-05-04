ALTER TABLE "learning_tracks" ADD COLUMN IF NOT EXISTS "is_universal" boolean DEFAULT false NOT NULL;
