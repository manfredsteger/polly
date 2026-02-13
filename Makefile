# Polly - Makefile
# Simplified commands for Docker operations and development

# Configuration
IMAGE_NAME ?= polly
IMAGE_TAG ?= latest
DOCKER_REGISTRY ?= docker.io
FULL_IMAGE_NAME = $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)

# Colors for output
GREEN = \033[0;32m
YELLOW = \033[0;33m
NC = \033[0m # No Color

.PHONY: help build run stop logs shell db-push db-studio clean dev prod publish setup setup-demo setup-mobile setup-mobile-demo test test-e2e test-e2e-ui test-e2e-headed test-all test-pdf test-docker test-pdf-docker rebuild fresh fresh-demo ci ci-docker purge complete clamav clamav-down clamav-logs clamav-status clamav-update lint validate-translations validate-translations-docker

# Default target
help:
	@echo "$(GREEN)Polly - Available Commands$(NC)"
	@echo ""
	@echo "$(YELLOW)Quick Setup:$(NC)"
	@echo "  make setup        - Zero-config start (just works!)"
	@echo "  make setup-demo   - Start with demo polls"
	@echo "  make setup-mobile - Start with auto-detected IP (for QR/smartphone)"
	@echo "  make setup-mobile-demo - Mobile + demo data"
	@echo "  make complete     - Full reset + demo data + ClamAV (all features)"
	@echo ""
	@echo "$(YELLOW)Development:$(NC)"
	@echo "  make dev          - Start development environment with hot-reload"
	@echo "  make dev-down     - Stop development environment"
	@echo "  make logs         - View application logs"
	@echo "  make shell        - Open shell in app container"
	@echo ""
	@echo "$(YELLOW)Production:$(NC)"
	@echo "  make build        - Build production Docker image"
	@echo "  make prod         - Start production environment"
	@echo "  make prod-down    - Stop production environment"
	@echo ""
	@echo "$(YELLOW)Database:$(NC)"
	@echo "  make db-push      - Push schema changes to database"
	@echo "  make db-studio    - Open Drizzle Studio (database viewer)"
	@echo "  make db-reset     - Reset database (WARNING: deletes all data)"
	@echo ""
	@echo "$(YELLOW)Docker Registry:$(NC)"
	@echo "  make publish      - Build and push image to Docker Hub"
	@echo "  make tag          - Tag image for registry"
	@echo ""
	@echo "$(YELLOW)Testing:$(NC)"
	@echo "  make test         - Run unit & integration tests"
	@echo "  make test-pdf     - Run PDF export tests (local)"
	@echo "  make test-pdf-docker - Run PDF export tests (in Docker)"
	@echo "  make test-e2e     - Run E2E tests with Playwright"
	@echo "  make test-e2e-ui  - Run E2E tests with Playwright UI"
	@echo "  make test-all     - Run all tests (unit + E2E)"
	@echo "  make ci           - Run local CI pipeline (lint + tests + build)"
	@echo ""
	@echo "$(YELLOW)Code Quality:$(NC)"
	@echo "  make lint         - Run all linting (TypeScript + translations)"
	@echo "  make validate-translations - Validate translation files (en/de)"
	@echo ""
	@echo "$(YELLOW)Docker Fresh Build:$(NC)"
	@echo "  make rebuild      - Rebuild image without cache"
	@echo "  make fresh        - Clean + rebuild + start (full reset)"
	@echo "  make fresh-demo   - Fresh start with demo data"
	@echo ""
	@echo "$(YELLOW)ClamAV Antivirus:$(NC)"
	@echo "  make clamav       - Start Polly with ClamAV antivirus"
	@echo "  make clamav-down  - Stop ClamAV service only"
	@echo "  make clamav-logs  - View ClamAV logs"
	@echo "  make clamav-status- Check ClamAV connection status"
	@echo "  make clamav-update- Update ClamAV virus definitions"
	@echo ""
	@echo "$(YELLOW)Maintenance:$(NC)"
	@echo "  make clean        - Remove containers (keeps data)"
	@echo "  make purge        - Remove containers AND all data (irreversible!)"
	@echo "  make prune        - Remove all unused Docker resources"

# ============================================
# Quick Setup (Zero-Config)
# ============================================

setup:
	@echo "$(GREEN)Starting Polly...$(NC)"
	docker compose up -d
	@echo "$(GREEN)App running at http://localhost:3080$(NC)"
	@echo "$(GREEN)Default admin: $${ADMIN_USERNAME:-admin} / $${ADMIN_PASSWORD:-Admin123!}$(NC)"

setup-demo:
	@echo "$(GREEN)Starting Polly with demo data...$(NC)"
	SEED_DEMO_DATA=true docker compose up -d
	@echo "$(GREEN)App running at http://localhost:3080$(NC)"
	@echo "$(GREEN)Demo polls created for testing$(NC)"

setup-mobile:
	@echo "$(GREEN)Starting Polly for mobile testing...$(NC)"
	./start-mobile.sh

setup-mobile-demo:
	@echo "$(GREEN)Starting Polly for mobile testing with demo data...$(NC)"
	./start-mobile.sh demo

# ============================================
# Development
# ============================================

dev:
	@echo "$(GREEN)Starting development environment...$(NC)"
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

dev-detached:
	@echo "$(GREEN)Starting development environment (detached)...$(NC)"
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

dev-down:
	@echo "$(YELLOW)Stopping development environment...$(NC)"
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down

# ============================================
# Production
# ============================================

build:
	@echo "$(GREEN)Building production image...$(NC)"
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .
	@echo "$(GREEN)Image built: $(IMAGE_NAME):$(IMAGE_TAG)$(NC)"

prod:
	@echo "$(GREEN)Starting production environment...$(NC)"
	docker compose up -d --build
	@echo "$(GREEN)Application running at http://localhost:3080$(NC)"

prod-down:
	@echo "$(YELLOW)Stopping production environment...$(NC)"
	docker compose down

restart:
	@echo "$(YELLOW)Restarting application...$(NC)"
	docker compose restart app

# ============================================
# Logs & Shell
# ============================================

logs:
	docker compose logs -f app

logs-all:
	docker compose logs -f

shell:
	docker compose exec app sh

shell-db:
	docker compose exec postgres psql -U $${POSTGRES_USER:-polly} -d $${POSTGRES_DB:-polly}

# ============================================
# Database
# ============================================

db-push:
	@echo "$(GREEN)Pushing schema changes to database...$(NC)"
	docker compose exec app npx drizzle-kit push

db-studio:
	@echo "$(GREEN)Opening Drizzle Studio...$(NC)"
	docker compose exec app npx drizzle-kit studio

db-reset:
	@echo "$(YELLOW)WARNING: This will delete all data!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	docker compose down -v
	docker compose up -d
	@echo "$(GREEN)Database reset complete$(NC)"

# ============================================
# Docker Registry (Docker Hub)
# ============================================

login:
	@echo "$(GREEN)Logging into Docker Hub...$(NC)"
	docker login $(DOCKER_REGISTRY)

tag:
	@echo "$(GREEN)Tagging image for registry...$(NC)"
	docker tag $(IMAGE_NAME):$(IMAGE_TAG) $(FULL_IMAGE_NAME)
	@echo "$(GREEN)Tagged: $(FULL_IMAGE_NAME)$(NC)"

push:
	@echo "$(GREEN)Pushing image to registry...$(NC)"
	docker push $(FULL_IMAGE_NAME)
	@echo "$(GREEN)Pushed: $(FULL_IMAGE_NAME)$(NC)"

publish: build tag push
	@echo "$(GREEN)Image published to $(FULL_IMAGE_NAME)$(NC)"

pull:
	@echo "$(GREEN)Pulling latest image from registry...$(NC)"
	docker pull $(FULL_IMAGE_NAME)

# ============================================
# Maintenance
# ============================================

clean:
	@echo "$(YELLOW)Removing containers (keeping data volumes)...$(NC)"
	docker compose down --remove-orphans
	docker rmi $(IMAGE_NAME):$(IMAGE_TAG) 2>/dev/null || true

purge:
	@echo "$(YELLOW)WARNING: This will DELETE ALL DATA including database and uploads!$(NC)"
	@read -p "Type 'DELETE' to confirm: " confirm && [ "$$confirm" = "DELETE" ] || (echo "Aborted." && exit 1)
	@echo "$(YELLOW)Removing containers and all data volumes...$(NC)"
	docker compose down -v --remove-orphans
	docker rmi $(IMAGE_NAME):$(IMAGE_TAG) 2>/dev/null || true
	@echo "$(GREEN)All data purged. Use 'make setup' to start fresh.$(NC)"

prune:
	@echo "$(YELLOW)Removing unused Docker resources...$(NC)"
	docker system prune -f
	docker volume prune -f

# ============================================
# Testing
# ============================================

test:
	@echo "$(GREEN)Running unit & integration tests...$(NC)"
	npx vitest run --pool=forks --poolOptions.forks.singleFork

test-e2e:
	@echo "$(GREEN)Running E2E tests with Playwright...$(NC)"
	npx playwright test

test-e2e-ui:
	@echo "$(GREEN)Running E2E tests with Playwright UI...$(NC)"
	npx playwright test --ui

test-e2e-headed:
	@echo "$(GREEN)Running E2E tests (headed mode)...$(NC)"
	npx playwright test --headed

test-all: test test-e2e
	@echo "$(GREEN)All tests completed!$(NC)"

test-pdf:
	@echo "$(GREEN)Running PDF export tests...$(NC)"
	npx vitest run server/tests/services/pdfService.test.ts

test-docker:
	@echo "$(GREEN)Running tests in Docker...$(NC)"
	docker compose exec app npx vitest run --pool=forks --poolOptions.forks.singleFork

test-pdf-docker:
	@echo "$(GREEN)Running PDF export tests in Docker...$(NC)"
	docker compose exec app npx vitest run server/tests/services/pdfService.test.ts

# ============================================
# Docker Rebuild (Fresh)
# ============================================

rebuild:
	@echo "$(YELLOW)Rebuilding Docker image (no cache)...$(NC)"
	docker compose build --no-cache
	@echo "$(GREEN)Rebuild complete!$(NC)"

fresh: clean
	@echo "$(GREEN)Fresh start: rebuilding containers (keeping data)...$(NC)"
	docker compose build --no-cache
	docker compose up -d
	@echo "$(GREEN)Fresh environment running at http://localhost:3080$(NC)"
	@echo "$(GREEN)Note: Data volumes preserved. Use 'make purge' to delete all data.$(NC)"

fresh-demo: clean
	@echo "$(GREEN)Fresh start with demo data...$(NC)"
	docker compose build --no-cache
	SEED_DEMO_DATA=true docker compose up -d
	@echo "$(GREEN)Fresh environment with demo data at http://localhost:3080$(NC)"

complete:
	@echo "$(YELLOW)=========================================$(NC)"
	@echo "$(YELLOW) POLLY - COMPLETE RESET$(NC)"
	@echo "$(YELLOW) Deletes ALL data, rebuilds from scratch$(NC)"
	@echo "$(YELLOW)=========================================$(NC)"
	@echo ""
	@echo "$(YELLOW)Step 1/6: Stopping all containers and removing volumes...$(NC)"
	docker compose --profile clamav down -v --remove-orphans 2>/dev/null || docker compose down -v --remove-orphans
	docker rmi $(IMAGE_NAME):$(IMAGE_TAG) 2>/dev/null || true
	@echo ""
	@echo "$(YELLOW)Step 2/6: Clearing Docker build cache...$(NC)"
	docker builder prune -af 2>/dev/null || true
	@echo ""
	@echo "$(YELLOW)Step 3/6: Rebuilding image from scratch (no cache, pull latest)...$(NC)"
	docker compose build --no-cache --pull
	@echo ""
	@echo "$(YELLOW)Step 4/6: Starting PostgreSQL...$(NC)"
	docker compose up -d postgres
	@echo ""
	@echo "$(YELLOW)Step 5/6: Waiting for PostgreSQL to be healthy...$(NC)"
	@TRIES=0; \
	while [ $$TRIES -lt 30 ]; do \
		if docker compose exec -T postgres pg_isready -U $${POSTGRES_USER:-polly} -d $${POSTGRES_DB:-polly} >/dev/null 2>&1; then \
			echo "$(GREEN)PostgreSQL is ready$(NC)"; \
			break; \
		fi; \
		TRIES=$$((TRIES + 1)); \
		sleep 1; \
	done; \
	if [ $$TRIES -ge 30 ]; then \
		echo "$(YELLOW)WARNING: PostgreSQL readiness check timed out, starting app anyway...$(NC)"; \
	fi
	@echo ""
	@echo "$(YELLOW)Step 6/6: Starting application with demo data + ClamAV...$(NC)"
	SEED_DEMO_DATA=true CLAMAV_HOST=clamav CLAMAV_PORT=3310 CLAMAV_ENABLED=true docker compose --profile clamav up -d
	@echo ""
	@echo "$(YELLOW)Waiting for app health check...$(NC)"
	@TRIES=0; \
	while [ $$TRIES -lt 60 ]; do \
		if docker compose exec -T app wget -q --spider http://localhost:5000/api/v1/health 2>/dev/null; then \
			echo "$(GREEN)Application is healthy!$(NC)"; \
			break; \
		fi; \
		TRIES=$$((TRIES + 1)); \
		sleep 2; \
	done; \
	if [ $$TRIES -ge 60 ]; then \
		echo "$(YELLOW)Health check timed out - check logs with: make logs$(NC)"; \
	fi
	@echo ""
	@echo "$(GREEN)=========================================$(NC)"
	@echo "$(GREEN) POLLY IS READY!$(NC)"
	@echo "$(GREEN)=========================================$(NC)"
	@echo "$(GREEN)  URL:   http://localhost:3080$(NC)"
	@echo "$(GREEN)  Admin: $${ADMIN_USERNAME:-admin} / $${ADMIN_PASSWORD:-Admin123!}$(NC)"
	@echo "$(GREEN)  Demo polls created$(NC)"
	@echo "$(GREEN)  ClamAV: active (virus DB download ~2-5 min)$(NC)"
	@echo "$(GREEN)=========================================$(NC)"

# ============================================
# CI Simulation (Local)
# ============================================

ci:
	@echo "$(GREEN)Running local CI pipeline...$(NC)"
	@echo "$(YELLOW)Step 1/5: Type checking...$(NC)"
	npx tsc --noEmit
	@echo "$(YELLOW)Step 2/5: Validate translations...$(NC)"
	node scripts/validate-translations.cjs
	@echo "$(YELLOW)Step 3/5: Unit tests...$(NC)"
	npx vitest run --pool=forks --poolOptions.forks.singleFork || true
	@echo "$(YELLOW)Step 4/5: Build...$(NC)"
	npm run build
	@echo "$(YELLOW)Step 5/5: E2E tests...$(NC)"
	npx playwright test || true
	@echo "$(GREEN)Local CI complete!$(NC)"

ci-docker:
	@echo "$(GREEN)Running CI in Docker environment...$(NC)"
	docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm app sh -c "npx tsc --noEmit && npx vitest run --pool=forks --poolOptions.forks.singleFork && npm run build"

# ============================================
# Version Management
# ============================================

version:
	@echo "$(IMAGE_NAME):$(IMAGE_TAG)"

release:
	@read -p "Enter version (e.g., 1.0.0): " version && \
	docker build -t $(IMAGE_NAME):$$version . && \
	docker tag $(IMAGE_NAME):$$version $(DOCKER_REGISTRY)/$(IMAGE_NAME):$$version && \
	docker push $(DOCKER_REGISTRY)/$(IMAGE_NAME):$$version && \
	echo "$(GREEN)Released: $(DOCKER_REGISTRY)/$(IMAGE_NAME):$$version$(NC)"

# ============================================
# ClamAV Antivirus (Optional)
# ============================================

clamav:
	@echo "$(GREEN)Starting Polly with ClamAV antivirus...$(NC)"
	docker compose --profile clamav up -d
	@echo "$(GREEN)ClamAV running on port 3310$(NC)"
	@echo "$(YELLOW)Note: First start takes ~2 min to download virus definitions$(NC)"
	@echo "$(GREEN)Configure in Admin Panel: Settings > Security > ClamAV$(NC)"

clamav-down:
	@echo "$(YELLOW)Stopping ClamAV service...$(NC)"
	docker compose --profile clamav stop clamav
	@echo "$(GREEN)ClamAV stopped (Polly still running)$(NC)"

clamav-logs:
	docker compose logs -f clamav

clamav-status:
	@echo "$(GREEN)Checking ClamAV status...$(NC)"
	@docker compose exec clamav clamdscan --ping 2>/dev/null && echo "$(GREEN)ClamAV is running and accepting connections$(NC)" || echo "$(YELLOW)ClamAV is not running or not ready$(NC)"

clamav-update:
	@echo "$(GREEN)Updating ClamAV virus definitions...$(NC)"
	docker compose exec clamav freshclam
	@echo "$(GREEN)Virus definitions updated$(NC)"

# ============================================
# Code Quality
# ============================================

lint:
	@echo "$(GREEN)Running all linting checks...$(NC)"
	@echo "$(YELLOW)Step 1/2: TypeScript check...$(NC)"
	npx tsc --noEmit
	@echo "$(YELLOW)Step 2/2: Translation validation...$(NC)"
	node scripts/validate-translations.cjs
	@echo "$(GREEN)All linting checks passed!$(NC)"

validate-translations:
	@echo "$(GREEN)Validating translation files...$(NC)"
	node scripts/validate-translations.cjs

validate-translations-docker:
	@echo "$(GREEN)Validating translations in Docker...$(NC)"
	docker compose exec app node scripts/validate-translations.cjs
