-- DropIndex
DROP INDEX "PartnerMembership_userId_partnerId_key";

-- CreateIndex
CREATE UNIQUE INDEX "PartnerMembership_userId_key" ON "PartnerMembership"("userId");

