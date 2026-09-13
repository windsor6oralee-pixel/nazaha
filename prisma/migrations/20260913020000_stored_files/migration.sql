-- CreateTable: binary file storage for STORAGE_PROVIDER=database.
-- Global table by design: rows are only reached through a key that was already
-- authorized via the owning (RLS-protected) document or organization row.
CREATE TABLE "stored_files" (
    "key" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("key")
);
