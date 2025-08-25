-- CreateTable
CREATE TABLE "public"."ImportedProduct" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "connectionId" TEXT,
    "shopifyProductId" TEXT,
    "title" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "vendor" TEXT,
    "productType" TEXT,
    "tags" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "price" TEXT,
    "compareAtPrice" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "weight" DOUBLE PRECISION,
    "weightUnit" TEXT,
    "inventoryQuantity" INTEGER,
    "requiresShipping" BOOLEAN NOT NULL DEFAULT true,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "images" TEXT,
    "options" TEXT,
    "variants" TEXT,
    "importSessionId" TEXT,
    "markupApplied" BOOLEAN NOT NULL DEFAULT false,
    "markupType" TEXT,
    "markupValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportSession" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "connectionId" TEXT,
    "dataSource" TEXT NOT NULL,
    "importType" TEXT NOT NULL,
    "importConfig" TEXT NOT NULL,
    "keyMappings" TEXT NOT NULL,
    "importFilters" TEXT NOT NULL,
    "markupConfig" TEXT NOT NULL,
    "totalProducts" INTEGER NOT NULL DEFAULT 0,
    "importedProducts" INTEGER NOT NULL DEFAULT 0,
    "failedProducts" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportSession_pkey" PRIMARY KEY ("id")
);
