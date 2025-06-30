/*
  Warnings:

  - Made the column `metodo_entrega` on table `CambioDivisa` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "CambioDivisa" ALTER COLUMN "metodo_entrega" SET NOT NULL;
