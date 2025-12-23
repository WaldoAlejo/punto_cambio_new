@echo off
cd /d "c:\Users\oswal\OneDrive\Documentos\Punto Cambio\punto_cambio_new"
npx prisma migrate dev --name fix_servientrega_ruc_unique_constraint
pause
