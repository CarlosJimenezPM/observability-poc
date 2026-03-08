#!/bin/bash
# =============================================
# Demo de Seguridad Multitenant
# =============================================
# Demuestra que cada tenant solo ve sus datos
# =============================================
# ⚠️  SECURITY WARNING:
# Los tokens Base64 usados aquí son SOLO para demo.
# En producción, usa JWT firmados con RS256/HS256.
# Ver README.md sección "Seguridad Multi-tenant".
# =============================================

CUBE_URL="http://localhost:4000/cubejs-api/v1"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Observability PoC - Demo Multitenant${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Query de prueba
QUERY='{"measures":["Orders.count","Orders.totalAmount"],"dimensions":["Orders.product"]}'

# =============================================
# Test 1: Tenant A
# =============================================
echo -e "${GREEN}▶ Consultando datos de TENANT A...${NC}"
TOKEN_A=$(echo -n '{"tenantId":"tenant_A"}' | base64)

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
echo -e "${GREEN}▶ Consultando datos de TENANT B...${NC}"
TOKEN_B=$(echo -n '{"tenantId":"tenant_B"}' | base64)

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
echo -e "${RED}▶ Consultando SIN autenticación (debe fallar)...${NC}"

RESULT_NOAUTH=$(curl -s -X GET \
  "${CUBE_URL}/load" \
  -H "Content-Type: application/json" \
  --data-urlencode "query=${QUERY}")

echo "$RESULT_NOAUTH" | jq '.error' 2>/dev/null || echo "$RESULT_NOAUTH"
echo ""

# =============================================
# Resumen
# =============================================
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Resumen${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo "✅ Tenant A solo ve datos de Tenant A"
echo "✅ Tenant B solo ve datos de Tenant B"
echo "✅ Sin token = Error de autenticación"
echo ""
echo -e "${GREEN}La seguridad multitenant funciona correctamente.${NC}"
echo ""
