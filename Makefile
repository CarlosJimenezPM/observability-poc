.PHONY: help up down logs simulator demo clean build

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
	@echo "  make up         - Levanta todo (infra + frontend)"
	@echo "  make down       - Para todo"
	@echo "  make logs       - Ver logs de Docker"
	@echo "  make build      - Rebuild de imágenes"
	@echo ""
	@echo "  make simulator  - Ejecuta el generador de datos"
	@echo "  make demo       - Ejecuta test de multitenancy JWT"
	@echo ""
	@echo "  make clean      - Limpia todo (containers + volumes)"
	@echo ""
	@echo "Arquitectura detectada: $(ARCH) → $(COMPOSE_FILE)"

# Docker
up:
	@echo "🐳 Levantando infraestructura + frontend..."
	docker compose -f $(COMPOSE_FILE) up -d
	@echo "⏳ Esperando a que los servicios estén listos..."
	@sleep 15
	@echo ""
	@echo "✅ Todo listo!"
	@echo "   Frontend: http://localhost:3000"
	@echo "   Cube.js:  http://localhost:4000"

down:
	docker compose -f $(COMPOSE_FILE) down

logs:
	docker compose -f $(COMPOSE_FILE) logs -f

build:
	docker compose -f $(COMPOSE_FILE) build

# Aplicaciones
simulator:
	@echo "📊 Ejecutando simulador..."
	@cd simulator && npm install --silent 2>/dev/null || true
	cd simulator && KAFKA_BROKER=localhost:19092 node simulator.js

demo:
	@echo "🔐 Ejecutando demo JWT..."
	@cd demo && npm install --silent 2>/dev/null || true
	cd demo && ./test_multitenancy.sh

# Limpieza
clean:
	@echo "🧹 Limpiando..."
	docker compose -f $(COMPOSE_FILE) down -v
	rm -rf simulator/node_modules
	rm -rf demo/node_modules
