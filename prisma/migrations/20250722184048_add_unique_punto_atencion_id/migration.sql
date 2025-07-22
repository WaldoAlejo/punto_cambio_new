/*
  Warnings:

  - A unique constraint covering the columns `[punto_atencion_id]` on the table `ServientregaSaldo` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ServientregaSaldo_punto_atencion_id_key" ON "ServientregaSaldo"("punto_atencion_id");
