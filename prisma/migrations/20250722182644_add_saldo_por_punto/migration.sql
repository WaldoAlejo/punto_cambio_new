/*
  Warnings:

  - Added the required column `punto_atencion_id` to the `ServientregaSaldo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ServientregaSaldo" ADD COLUMN     "punto_atencion_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "ServientregaSaldo" ADD CONSTRAINT "ServientregaSaldo_punto_atencion_id_fkey" FOREIGN KEY ("punto_atencion_id") REFERENCES "PuntoAtencion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
