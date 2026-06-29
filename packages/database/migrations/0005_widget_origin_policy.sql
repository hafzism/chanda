ALTER TABLE "channel_connections" ADD COLUMN "allowed_origins" text[] DEFAULT ARRAY[]::text[] NOT NULL;
