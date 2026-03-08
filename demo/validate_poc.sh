#!/bin/bash
# =============================================
# Validación de PoC - Observabilidad Real-Time
# =============================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0

check() {
    local name="$1"
    local result="$2"
    
    if [ "$result" = "true" ]; then
        echo -e "${GREEN}✅ $name${NC}"
        ((PASS++))
    else
        echo -e "${RED}❌ $name${NC}"
        ((FAIL++))
    fi
}

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Validación PoC Observabilidad Real-Time${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# =============================================
# 1. Verificar contenedores
# =============================================
echo -e "${YELLOW}▶ 1. Verificando infraestructura...${NC}"

POSTGRES_UP=$(docker ps --filter "name=postgres" --filter "status=running" -q | wc -l)
REDPANDA_UP=$(docker ps --filter "name=redpanda" --filter "status=running" -q | wc -l)
CLICKHOUSE_UP=$(docker ps --filter "name=clickhouse" --filter "status=running" -q | wc -l)
CUBE_UP=$(docker ps --filter "name=cube" --filter "status=running" -q | wc -l)

check "PostgreSQL running" "$([ $POSTGRES_UP -ge 1 ] && echo true || echo false)"
check "Redpanda running" "$([ $REDPANDA_UP -ge 1 ] && echo true || echo false)"
check "ClickHouse running" "$([ $CLICKHOUSE_UP -ge 1 ] && echo true || echo false)"
check "Cube.js running" "$([ $CUBE_UP -ge 1 ] && echo true || echo false)"

echo ""

# =============================================
# 2. Verificar datos en ClickHouse
# =============================================
echo -e "${YELLOW}▶ 2. Verificando datos en ClickHouse...${NC}"

# Contar registros en orders_olap
COUNT=$(curl -s "http://localhost:8123/?query=SELECT%20count()%20FROM%20orders_olap" 2>/dev/null || echo "0")
check "Datos en ClickHouse (orders_olap)" "$([ "$COUNT" -gt 0 ] 2>/dev/null && echo true || echo false)"

if [ "$COUNT" -gt 0 ] 2>/dev/null; then
    echo -e "   ${BLUE}→ $COUNT registros encontrados${NC}"
fi

# Verificar datos por tenant
TENANTS=$(curl -s "http://localhost:8123/?query=SELECT%20uniq(tenant_id)%20FROM%20orders_olap" 2>/dev/null || echo "0")
check "Múltiples tenants en datos" "$([ "$TENANTS" -gt 1 ] 2>/dev/null && echo true || echo false)"

if [ "$TENANTS" -gt 0 ] 2>/dev/null; then
    echo -e "   ${BLUE}→ $TENANTS tenants distintos${NC}"
fi

echo ""

# =============================================
# 3. Verificar latencia de queries OLAP
# =============================================
echo -e "${YELLOW}▶ 3. Verificando rendimiento OLAP...${NC}"

START=$(date +%s%3N)
RESULT=$(curl -s "http://localhost:8123/?query=SELECT%20tenant_id,%20sum(amount)%20FROM%20orders_olap%20GROUP%20BY%20tenant_id" 2>/dev/null)
END=$(date +%s%3N)
LATENCY=$((END - START))

check "Query OLAP responde" "$([ -n "$RESULT" ] && echo true || echo false)"
check "Latencia < 500ms" "$([ $LATENCY -lt 500 ] && echo true || echo false)"
echo -e "   ${BLUE}→ Latencia: ${LATENCY}ms${NC}"

echo ""

# =============================================
# 4. Verificar Cube.js API
# =============================================
echo -e "${YELLOW}▶ 4. Verificando Cube.js API...${NC}"

# Health check
CUBE_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:4000/readyz" 2>/dev/null || echo "000")
check "Cube.js health" "$([ "$CUBE_HEALTH" = "200" ] && echo true || echo false)"

# Meta endpoint
CUBE_META=$(curl -s "http://localhost:4000/cubejs-api/v1/meta" 2>/dev/null | grep -c "Orders" || echo "0")
check "Schema Orders cargado" "$([ "$CUBE_META" -ge 1 ] && echo true || echo false)"

echo ""

# =============================================
# 5. Verificar seguridad multitenant
# =============================================
echo -e "${YELLOW}▶ 5. Verificando seguridad multitenant...${NC}"

# Token para Tenant A
TOKEN_A=$(echo -n '{"tenantId":"tenant_A"}' | base64)
# Token para Tenant B
TOKEN_B=$(echo -n '{"tenantId":"tenant_B"}' | base64)

# Query con token A
RESULT_A=$(curl -s -H "Authorization: Bearer $TOKEN_A" \
  "http://localhost:4000/cubejs-api/v1/load?query=%7B%22measures%22%3A%5B%22Orders.count%22%5D%7D" 2>/dev/null)

# Query con token B
RESULT_B=$(curl -s -H "Authorization: Bearer $TOKEN_B" \
  "http://localhost:4000/cubejs-api/v1/load?query=%7B%22measures%22%3A%5B%22Orders.count%22%5D%7D" 2>/dev/null)

# Query sin token (debe fallar)
RESULT_NO=$(curl -s \
  "http://localhost:4000/cubejs-api/v1/load?query=%7B%22measures%22%3A%5B%22Orders.count%22%5D%7D" 2>/dev/null)

HAS_DATA_A=$(echo "$RESULT_A" | grep -c "data" || echo "0")
HAS_DATA_B=$(echo "$RESULT_B" | grep -c "data" || echo "0")
HAS_ERROR_NO=$(echo "$RESULT_NO" | grep -ci "error\|unauthorized" || echo "0")

check "Tenant A obtiene datos" "$([ "$HAS_DATA_A" -ge 1 ] && echo true || echo false)"
check "Tenant B obtiene datos" "$([ "$HAS_DATA_B" -ge 1 ] && echo true || echo false)"
check "Sin token = error" "$([ "$HAS_ERROR_NO" -ge 1 ] && echo true || echo false)"

# Verificar que son datos diferentes (isolation)
COUNT_A=$(echo "$RESULT_A" | grep -o '"Orders.count":[0-9]*' | grep -o '[0-9]*' || echo "0")
COUNT_B=$(echo "$RESULT_B" | grep -o '"Orders.count":[0-9]*' | grep -o '[0-9]*' || echo "0")

if [ "$COUNT_A" != "$COUNT_B" ] 2>/dev/null; then
    check "Datos aislados entre tenants" "true"
    echo -e "   ${BLUE}→ Tenant A: $COUNT_A pedidos${NC}"
    echo -e "   ${BLUE}→ Tenant B: $COUNT_B pedidos${NC}"
else
    check "Datos aislados entre tenants" "false"
fi

echo ""

# =============================================
# Resumen
# =============================================
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Resumen${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "  ${GREEN}Pasaron: $PASS${NC}"
echo -e "  ${RED}Fallaron: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 ¡PoC EXITOSA! Todos los criterios cumplidos.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  PoC con problemas. Revisa los criterios fallidos.${NC}"
    exit 1
fi
