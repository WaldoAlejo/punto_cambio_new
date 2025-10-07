#!/bin/bash

# Script wrapper para ejecutar la reconciliación masiva
# Configura el entorno Node.js correctamente

# Cargar NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Ir al directorio del proyecto
cd "$(dirname "$0")/.."

# Ejecutar el script
npx tsx scripts/reconciliar-todos-saldos.ts