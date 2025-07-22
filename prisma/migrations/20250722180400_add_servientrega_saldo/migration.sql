-- CreateTable
CREATE TABLE "ServientregaSaldo" (
    "id" TEXT NOT NULL,
    "monto_total" DECIMAL(15,2) NOT NULL,
    "monto_usado" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "creado_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServientregaSaldo_pkey" PRIMARY KEY ("id")
);
