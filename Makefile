.PHONY: help install up down logs simulator frontend demo clean

# Default target
help:
	@echo "🔭 Observability PoC - Comandos disponibles:"
	@echo ""
	@echo "  make install    - Instala dependencias (npm install)"
	@echo "  make up         - Levanta infraestructura (Docker)"
	@echo "  make down       - Para infraestructura"
	@echo "  make logs       - Ver logs de Docker"
	@echo ""
	@echo "  make simulator  - Ejecuta el generador de datos"
	@echo "  make frontend   - Ejecuta el frontend (http://localhost:3000)"
	@echo "  make demo       - Ejecuta test de multitenancy JWT"
	@echo ""
	@echo "  make start      - Todo: up + install + frontend + simulator"
	@echo "  make clean      - Limpia todo (containers + node_modules)"

# Instalar dependencias
install:
	@echo "📦 Instalando dependencias..."
	cd simulator && npm install
	cd frontend && npm install
	cd demo && npm install

# Docker
up:
	@echo "🐳 Levantando infraestructura..."
	docker compose up -d
	@echo "⏳ Esperando a que los servicios estén listos..."
	@sleep 10
	@echo "✅ Servicios listos"

down:
	docker compose down

logs:
	docker compose logs -f

# Aplicaciones
simulator:
	@echo "📊 Ejecutando simulador..."
	cd simulator && KAFKA_BROKER=localhost:19092 node simulator.js

frontend:
	@echo "🖥️  Ejecutando frontend en http://localhost:3000"
	cd frontend && npm start

demo:
	@echo "🔐 Ejecutando demo JWT..."
	cd demo && ./test_multitenancy.sh

# Todo junto
start: up install
	@echo ""
	@echo "✅ Infraestructura lista!"
	@echo ""
	@echo "Ahora ejecuta en terminales separadas:"
	@echo "  make simulator   (Terminal 1)"
	@echo "  make frontend    (Terminal 2)"
	@echo ""
	@echo "O abre http://localhost:4000 para Cube.js Playground"

# Limpieza
clean: down
	@echo "🧹 Limpiando..."
	rm -rf simulator/node_modules
	rm -rf frontend/node_modules
	rm -rf demo/node_modules
	docker compose down -v
