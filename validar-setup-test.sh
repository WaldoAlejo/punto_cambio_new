#!/bin/bash

# Script para validar que el ambiente está listo para el test

echo ""
echo "════════════════════════════════════════════════════════════"
echo "🔍 VALIDANDO SETUP DEL TEST"
echo "════════════════════════════════════════════════════════════"

ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# =====================================================================
# 1. VERIFICAR NODE.JS Y NPM
# =====================================================================
echo -e "\n${BLUE}1. Verificando Node.js y npm...${NC}"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Node.js instalado: $NODE_VERSION${NC}"
else
    echo -e "${RED}✗ Node.js NO está instalado${NC}"
    ERRORS=$((ERRORS + 1))
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✓ npm instalado: $NPM_VERSION${NC}"
else
    echo -e "${RED}✗ npm NO está instalado${NC}"
    ERRORS=$((ERRORS + 1))
fi

# =====================================================================
# 2. VERIFICAR ARCHIVO PACKAGE.JSON
# =====================================================================
echo -e "\n${BLUE}2. Verificando package.json...${NC}"

if [ -f "package.json" ]; then
    echo -e "${GREEN}✓ package.json encontrado${NC}"
    
    # Verificar si tiene axios
    if grep -q '"axios"' package.json; then
        echo -e "${GREEN}✓ axios está en dependencias${NC}"
    else
        echo -e "${YELLOW}⚠ axios NO está en package.json - se instalará con tsx${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    # Verificar si tiene tsx
    if grep -q '"tsx"' package.json; then
        echo -e "${GREEN}✓ tsx está disponible${NC}"
    else
        echo -e "${RED}✗ tsx NO está en package.json${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗ package.json NO encontrado${NC}"
    ERRORS=$((ERRORS + 1))
fi

# =====================================================================
# 3. VERIFICAR NODE_MODULES
# =====================================================================
echo -e "\n${BLUE}3. Verificando node_modules...${NC}"

if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓ node_modules existe${NC}"
else
    echo -e "${YELLOW}⚠ node_modules no existe - ejecutar: npm install${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# =====================================================================
# 4. VERIFICAR ARCHIVOS DE TEST
# =====================================================================
echo -e "\n${BLUE}4. Verificando archivos de test...${NC}"

TEST_FILES=(
    "test-flujo-anulacion.ts"
    "test-flujo-anulacion.sh"
    "obtener-datos-test.sh"
    "GUIA-TEST-ANULACION.md"
    "INSTRUCCIONES-RAPIDAS-TEST.md"
)

for file in "${TEST_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ $file${NC}"
    else
        echo -e "${RED}✗ $file NO encontrado${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

# =====================================================================
# 5. VERIFICAR VARIABLES DE ENTORNO
# =====================================================================
echo -e "\n${BLUE}5. Verificando variables de entorno...${NC}"

if [ -f ".env" ]; then
    echo -e "${GREEN}✓ .env encontrado${NC}"
    
    if grep -q "DATABASE_URL" .env; then
        echo -e "${GREEN}✓ DATABASE_URL configurada${NC}"
    else
        echo -e "${RED}✗ DATABASE_URL NO configurada${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "VITE_API_URL" .env; then
        API_URL=$(grep "VITE_API_URL" .env | cut -d'=' -f2 | tr -d '"')
        echo -e "${GREEN}✓ VITE_API_URL configurada: $API_URL${NC}"
    else
        echo -e "${RED}✗ VITE_API_URL NO configurada${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗ .env NO encontrado${NC}"
    ERRORS=$((ERRORS + 1))
fi

# =====================================================================
# 6. VERIFICAR PUERTO 3001
# =====================================================================
echo -e "\n${BLUE}6. Verificando puerto 3001...${NC}"

if nc -z localhost 3001 2>/dev/null; then
    echo -e "${GREEN}✓ Servidor está ejecutándose en puerto 3001${NC}"
else
    echo -e "${YELLOW}⚠ Puerto 3001 no está respondiendo${NC}"
    echo -e "${YELLOW}   (Ejecuta: npm run dev:server)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# =====================================================================
# 7. VERIFICAR BASE DE DATOS
# =====================================================================
echo -e "\n${BLUE}7. Verificando conexión a BD...${NC}"

if [ -f ".env" ]; then
    DATABASE_URL=$(grep "DATABASE_URL" .env | cut -d'=' -f2 | tr -d '"')
    if [ ! -z "$DATABASE_URL" ]; then
        if psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null; then
            echo -e "${GREEN}✓ Conexión a BD exitosa${NC}"
            
            # Contar usuarios
            USER_COUNT=$(psql "$DATABASE_URL" -tc "SELECT COUNT(*) FROM \"Usuario\" WHERE activo = true;" 2>/dev/null || echo "0")
            echo -e "${GREEN}✓ Usuarios activos en BD: $USER_COUNT${NC}"
            
            # Contar puntos
            POINT_COUNT=$(psql "$DATABASE_URL" -tc "SELECT COUNT(*) FROM \"PuntoAtencion\";" 2>/dev/null || echo "0")
            echo -e "${GREEN}✓ Puntos de atención: $POINT_COUNT${NC}"
        else
            echo -e "${RED}✗ No se pudo conectar a BD${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo -e "${YELLOW}⚠ DATABASE_URL no está configurada correctamente${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

# =====================================================================
# 8. VERIFICAR PRISMA
# =====================================================================
echo -e "\n${BLUE}8. Verificando Prisma...${NC}"

if [ -f "prisma/schema.prisma" ]; then
    echo -e "${GREEN}✓ prisma/schema.prisma encontrado${NC}"
else
    echo -e "${RED}✗ prisma/schema.prisma NO encontrado${NC}"
    ERRORS=$((ERRORS + 1))
fi

# =====================================================================
# RESUMEN FINAL
# =====================================================================
echo ""
echo "════════════════════════════════════════════════════════════"
echo "📊 RESULTADO DE VALIDACIÓN"
echo "════════════════════════════════════════════════════════════"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ TODO ESTÁ LISTO PARA EL TEST${NC}"
    echo ""
    echo "Próximo paso: ejecutar"
    echo "  npx tsx test-flujo-anulacion.ts"
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  SETUP COMPLETO CON ADVERTENCIAS${NC}"
    echo "Puedes proceder con el test, pero considera las advertencias"
    echo ""
    exit 0
else
    echo -e "${RED}❌ HAY ERRORES - CORREGIR ANTES DE CONTINUAR${NC}"
    echo ""
    echo "Errores encontrados: $ERRORS"
    echo "Advertencias: $WARNINGS"
    echo ""
    exit 1
fi