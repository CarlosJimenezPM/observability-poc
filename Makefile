.PHONY: help up down logs logs-cdc simulator demo clean build status

# Detectar arquitectura (ARM usa docker-compose.arm.yml)
ARCH := $(shell uname -m)
ifeq ($(ARCH),aarch64)
  COMPOSE_FILE := docker-compose.arm.yml
else ifeq ($(ARCH),arm64)
  COMPOSE_FILE := docker-compose.arm.yml
else
  COMPOSE_FILE := docker-compose.yml
endif

# Default target
help:
	@echo "🔭 Observability PoC - Comandos disponibles:"
	@echo ""
	@echo "  make up         - Levanta todo (infra + frontend + CDC)"
	@echo "  make down       - Para todo"
	@echo "  make status     - Estado de servicios"
	@echo "  make logs       - Ver logs de Docker"
	@echo "  make logs-cdc   - Ver logs de Debezium (CDC)"
	@echo "  make build      - Rebuild de imágenes"
	@echo ""
	@echo "  make simulator  - Ejecuta el generador de datos"
	@echo "  make demo       - Ejecuta test de multitenancy JWT"
	@echo ""
	@echo "  make clean      - Limpia todo (containers + volumes)"
	@echo ""
	@echo "Arquitectura detectada: $(ARCH) → $(COMPOSE_FILE)"
	@echo ""
	@echo "📋 Data Flow (CDC):"
	@echo "   Simulator → PostgreSQL → Debezium → Redpanda → ClickHouse"

# Docker
up:
	@echo "🐳 Levantando infraestructura con CDC..."
	docker compose -f $(COMPOSE_FILE) up -d
	@echo "⏳ Esperando a que los servicios estén listos..."
	@sleep 20
	@echo ""
	@echo "✅ Todo listo!"
	@echo "   Frontend: http://localhost:3000"
	@echo "   Cube.js:  http://localhost:4000"
	@echo ""
	@echo "📋 CDC Pipeline activo:"
	@echo "   PostgreSQL → Debezium → Redpanda → ClickHouse"
	@echo ""
	@echo "💡 Ejecuta 'make simulator' para generar datos de prueba"

down:
	docker compose -f $(COMPOSE_FILE) down

status:
	@echo "📊 Estado de servicios:"
	@docker compose -f $(COMPOSE_FILE) ps

logs:
	docker compose -f $(COMPOSE_FILE) logs -f

logs-cdc:
	@echo "📋 Logs de Debezium CDC..."
	docker compose -f $(COMPOSE_FILE) logs -f debezium

build:
	docker compose -f $(COMPOSE_FILE) build --no-cache

# Aplicaciones
simulator:
	@echo "📊 Ejecutando simulador (CDC mode - solo escribe a PostgreSQL)..."
	@cd simulator && npm install --silent 2>/dev/null || true
	cd simulator && node simulator.js

demo:
	@echo "🔐 Ejecutando demo JWT..."
	@cd demo && npm install --silent 2>/dev/null || true
	cd demo && ./test_multitenancy.sh

# Limpieza
clean:
	@echo "🧹 Limpiando todo..."
	docker compose -f $(COMPOSE_FILE) down -v
	rm -rf simulator/node_modules
	rm -rf demo/node_modules
	rm -rf frontend/node_modules
	@echo "✅ Limpio"
