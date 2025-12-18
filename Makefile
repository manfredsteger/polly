# KITA Poll - Makefile
# Simplified commands for Docker operations and development

# Configuration
IMAGE_NAME ?= kita-poll
IMAGE_TAG ?= latest
DOCKER_REGISTRY ?= docker.io
FULL_IMAGE_NAME = $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)

# Colors for output
GREEN = \033[0;32m
YELLOW = \033[0;33m
NC = \033[0m # No Color

.PHONY: help build run stop logs shell db-push db-studio clean dev prod publish setup setup-demo

# Default target
help:
	@echo "$(GREEN)KITA Poll - Available Commands$(NC)"
	@echo ""
	@echo "$(YELLOW)Quick Setup:$(NC)"
	@echo "  make setup        - Zero-config start (just works!)"
	@echo "  make setup-demo   - Start with demo polls"
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
	@echo "$(YELLOW)Maintenance:$(NC)"
	@echo "  make clean        - Remove containers and volumes"
	@echo "  make prune        - Remove all unused Docker resources"

# ============================================
# Quick Setup (Zero-Config)
# ============================================

setup:
	@echo "$(GREEN)Starting KITA Poll...$(NC)"
	docker compose up -d
	@echo "$(GREEN)App running at http://localhost:5000$(NC)"

setup-demo:
	@echo "$(GREEN)Starting KITA Poll with demo data...$(NC)"
	SEED_DEMO_DATA=true docker compose up -d
	@echo "$(GREEN)App running at http://localhost:5000$(NC)"
	@echo "$(GREEN)Demo polls created for testing$(NC)"

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
	@echo "$(GREEN)Application running at http://localhost:5000$(NC)"

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
	docker compose exec postgres psql -U kitapoll -d kitapoll

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
	@echo "$(YELLOW)Removing containers and volumes...$(NC)"
	docker compose down -v --remove-orphans
	docker rmi $(IMAGE_NAME):$(IMAGE_TAG) 2>/dev/null || true

prune:
	@echo "$(YELLOW)Removing unused Docker resources...$(NC)"
	docker system prune -f
	docker volume prune -f

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
