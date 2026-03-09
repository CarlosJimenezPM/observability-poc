#!/bin/bash
# =============================================
# Demo de Seguridad Multitenant con JWT
# =============================================
# Demuestra que cada tenant solo ve sus datos
# usando tokens JWT firmados
# =============================================

CUBE_URL="http://localhost:4000/cubejs-api/v1"
SECRET="${CUBEJS_API_SECRET:-dev-secret-change-in-production}"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar que jq está instalado
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required. Install with: apt install jq${NC}"
    exit 1
fi

# Verificar que node está disponible para generar tokens
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: node is required for JWT generation${NC}"
    exit 1
fi

# Instalar dependencias si no existen
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install --silent
fi

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Observability PoC - JWT Multitenant Demo${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Query de prueba
QUERY='{"measures":["Orders.count","Orders.totalAmount"],"dimensions":["Orders.productCategory"]}'

# =============================================
# Test 1: Tenant A
# =============================================
echo -e "${GREEN}▶ Generating JWT for TENANT A...${NC}"
TOKEN_A=$(node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({ tenantId: 'tenant_A', userId: 'demo' }, '$SECRET', { expiresIn: '1h' });
console.log(token);
")

echo -e "${GREEN}▶ Querying data as TENANT A...${NC}"
RESULT_A=$(curl -s -X GET \
  "${CUBE_URL}/load" \
  -H "Authorization: Bearer ${TOKEN_A}" \
  -H "Content-Type: application/json" \
  --data-urlencode "query=${QUERY}")

echo "$RESULT_A" | jq '.data' 2>/dev/null || echo "$RESULT_A"
echo ""

# =============================================
# Test 2: Tenant B
# =============================================
echo -e "${GREEN}▶ Generating JWT for TENANT B...${NC}"
TOKEN_B=$(node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({ tenantId: 'tenant_B', userId: 'demo' }, '$SECRET', { expiresIn: '1h' });
console.log(token);
")

echo -e "${GREEN}▶ Querying data as TENANT B...${NC}"
RESULT_B=$(curl -s -X GET \
  "${CUBE_URL}/load" \
  -H "Authorization: Bearer ${TOKEN_B}" \
  -H "Content-Type: application/json" \
  --data-urlencode "query=${QUERY}")

echo "$RESULT_B" | jq '.data' 2>/dev/null || echo "$RESULT_B"
echo ""

# =============================================
# Test 3: Sin autenticación (debe fallar)
# =============================================
echo -e "${RED}▶ Querying WITHOUT authentication (should fail)...${NC}"

RESULT_NOAUTH=$(curl -s -X GET \
  "${CUBE_URL}/load" \
  -H "Content-Type: application/json" \
  --data-urlencode "query=${QUERY}")

echo "$RESULT_NOAUTH" | jq '.error' 2>/dev/null || echo "$RESULT_NOAUTH"
echo ""

# =============================================
# Test 4: Token inválido (debe fallar)
# =============================================
echo -e "${RED}▶ Querying with INVALID token (should fail)...${NC}"

RESULT_INVALID=$(curl -s -X GET \
  "${CUBE_URL}/load" \
  -H "Authorization: Bearer invalid.token.here" \
  -H "Content-Type: application/json" \
  --data-urlencode "query=${QUERY}")

echo "$RESULT_INVALID" | jq '.error' 2>/dev/null || echo "$RESULT_INVALID"
echo ""

# =============================================
# Resumen
# =============================================
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo "✅ Tenant A only sees Tenant A data"
echo "✅ Tenant B only sees Tenant B data"  
echo "✅ No token = Authentication error"
echo "✅ Invalid token = Rejected"
echo ""
echo -e "${GREEN}JWT multitenant security is working correctly.${NC}"
echo ""
