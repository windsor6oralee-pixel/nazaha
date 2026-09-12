-- CreateEnum
CREATE TYPE "PreboardingSender" AS ENUM ('HR', 'CANDIDATE');

-- CreateEnum
CREATE TYPE "PreboardingMsgType" AS ENUM ('TEXT', 'FILE', 'PING', 'PING_RESPONSE', 'FILE_REQUEST');

-- CreateTable
CREATE TABLE "preboarding_channels" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "bidirectional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preboarding_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preboarding_messages" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "senderType" "PreboardingSender" NOT NULL,
    "senderId" TEXT NOT NULL,
    "type" "PreboardingMsgType" NOT NULL,
    "content" TEXT,
    "filePath" TEXT,
    "fileName" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preboarding_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "preboarding_channels_applicationId_key" ON "preboarding_channels"("applicationId");

-- CreateIndex
CREATE INDEX "preboarding_messages_channelId_createdAt_idx" ON "preboarding_messages"("channelId", "createdAt");

-- AddForeignKey
ALTER TABLE "preboarding_channels" ADD CONSTRAINT "preboarding_channels_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preboarding_messages" ADD CONSTRAINT "preboarding_messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "preboarding_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
