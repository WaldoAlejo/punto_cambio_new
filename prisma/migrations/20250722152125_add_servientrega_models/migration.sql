-- CreateTable
CREATE TABLE "ServientregaRemitente" (
    "id" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "codigo_postal" TEXT,
    "email" TEXT,

    CONSTRAINT "ServientregaRemitente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServientregaDestinatario" (
    "id" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "pais" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "codigo_postal" TEXT,

    CONSTRAINT "ServientregaDestinatario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServientregaGuia" (
    "id" TEXT NOT NULL,
    "numero_guia" TEXT NOT NULL,
    "proceso" TEXT NOT NULL,
    "base64_response" TEXT,
    "remitente_id" TEXT NOT NULL,
    "destinatario_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServientregaGuia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServientregaGuia_numero_guia_key" ON "ServientregaGuia"("numero_guia");

-- CreateIndex
CREATE INDEX "ServientregaGuia_numero_guia_idx" ON "ServientregaGuia"("numero_guia");

-- AddForeignKey
ALTER TABLE "ServientregaGuia" ADD CONSTRAINT "ServientregaGuia_remitente_id_fkey" FOREIGN KEY ("remitente_id") REFERENCES "ServientregaRemitente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServientregaGuia" ADD CONSTRAINT "ServientregaGuia_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "ServientregaDestinatario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
