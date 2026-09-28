-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "bookingCutoffMinutes" INTEGER NOT NULL DEFAULT 720,
ADD COLUMN     "facebookUrl" TEXT,
ADD COLUMN     "instagramHandle" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "tiktokHandle" TEXT,
ADD COLUMN     "websiteUrl" TEXT,
ADD COLUMN     "xHandle" TEXT;
