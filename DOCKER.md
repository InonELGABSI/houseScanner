# Docker Setup Guide

This project uses Docker and Docker Compose for both development and production environments.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2.0+

## Architecture

### Development Environment
- **PostgreSQL** - Local database
- **Redis** - Local cache
- **MinIO** - Local S3-compatible storage

### Production Environment  
- **AWS RDS** - PostgreSQL database
- **AWS S3** - Object storage
- **Redis** - Local cache (containerized)

## Quick Start

### Development Environment

1. **Setup environment files for each service:**
   ```bash
   # Agents Service
   cp agents-service/.env.example agents-service/.env
   
   # Backend
   cp backend/.env.example backend/.env
   
   # Client PWA
   cp client-pwa/.env.example client-pwa/.env
   ```

2. **Edit the `.env` files and set required values:**
   - `agents-service/.env` - Set `OPENAI_API_KEY`
   - `backend/.env` - Already configured for Docker
   - `client-pwa/.env` - Already configured for Docker

3. **Start all services:**
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   # Or use make
   make dev
   ```

4. **View logs:**
   ```bash
   docker compose -f docker-compose.dev.yml logs -f
   # Or use make
   make logs-dev
   ```

5. **Access services:**
   - Client PWA: http://localhost:5173
   - Backend API: http://localhost:3000/api/v1
   - Agents Service: http://localhost:8000
   - MinIO Console: http://localhost:9001 (credentials: minio/minio123)
   - PostgreSQL: localhost:5432 (credentials: house_scanner/house_scanner)
   - Redis: localhost:6379

### Production Environment

1. **Setup environment files for each service:**
   ```bash
   # Agents Service
   cp agents-service/.env.example.prod agents-service/.env.prod
   
   # Backend
   cp backend/.env.example.prod backend/.env.prod
   
   # Client PWA
   cp client-pwa/.env.example.prod client-pwa/.env.prod
   ```

2. **Edit the `.env.prod` files with your production values:**
   
   **agents-service/.env.prod:**
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `CORS_ORIGINS` - Your production domains (JSON array format)
   - `ALLOW_LOCALHOST_URLS=false`
   - `THROTTLE_MS=100` - Enable rate limiting

   **backend/.env.prod:**
   - `DATABASE_URL` - AWS RDS PostgreSQL connection string
   - `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`
   - `JWT_SECRET` - Strong random string (at least 32 characters)
   - `CORS_ORIGINS` - Your production domain
   - `STORAGE_PUBLIC_URL` - Your S3 bucket public URL

   **client-pwa/.env.prod:**
   - `VITE_API_URL` - Your production API URL (https://api.yourdomain.com)
   - `VITE_WS_URL` - Your production WebSocket URL (wss://api.yourdomain.com)

3. **Build and start production services:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   # Or use make
   make prod
   ```

4. **Run database migrations:**
   ```bash
   docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
   # Or use make
   make migrate-prod
   ```

5. **Access services:**
   - Client PWA: http://localhost:8080
   - Backend API: http://localhost:3000/api/v1
   - Agents Service: http://localhost:8000

## Service Architecture

### Application Services
- **agents-service** - Python FastAPI service for AI agents (port 8000)
- **backend** - NestJS API server (port 3000)
- **client-pwa** - React PWA frontend (dev: 5173, prod: 8080)

### Development Infrastructure
- **PostgreSQL** - Local database (port 5432)
- **Redis** - Local cache (port 6379)
- **MinIO** - Local S3-compatible storage (port 9000, console: 9001)

### Production Infrastructure
- **AWS RDS PostgreSQL** - Managed database
- **AWS S3** - Managed object storage
- **Redis** - Containerized cache (port 6379)

## Common Commands

### Using Make (Recommended)

```bash
# Development
make dev              # Start dev environment
make dev-build        # Build and start dev
make stop-dev         # Stop dev services
make clean-dev        # Stop and remove volumes
make logs-dev         # Follow dev logs
make migrate-dev      # Run migrations
make infra-dev        # Start only infra (postgres, redis, minio)

# Production
make prod             # Start prod environment
make prod-build       # Build and start prod
make stop-prod        # Stop prod services
make clean-prod       # Stop and remove volumes
make logs-prod        # Follow prod logs
make migrate-prod     # Deploy migrations
make infra-prod       # Start only infra (redis)

# Utilities
make shell-backend-dev    # Shell in backend dev
make shell-agents-dev     # Shell in agents dev
make db-shell-dev         # PostgreSQL shell (dev only)
make help                 # Show all commands
```

### Using Docker Compose Directly

```bash
# Development
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml logs -f

# Production
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml logs -f

# Infrastructure only (dev)
docker compose -f docker-compose.dev.yml up -d postgres redis minio

# Rebuild services
docker compose -f docker-compose.dev.yml build
docker compose -f docker-compose.prod.yml build

# View specific service logs
docker compose -f docker-compose.dev.yml logs -f backend
docker compose -f docker-compose.dev.yml logs -f agents-service
```

### Database Migrations

```bash
# Development
make migrate-dev
# Or:
docker compose -f docker-compose.dev.yml exec backend npm run prisma:migrate

# Production
make migrate-prod
# Or:
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### Access Service Shells

```bash
# Backend
docker compose exec backend-dev sh

# Agents Service
docker compose exec agents-service-dev bash

# PostgreSQL
docker compose exec postgres psql -U house_scanner -d house_scanner
```

## Environment Variables

### Required Variables
- `OPENAI_API_KEY` - OpenAI API key for agents service
- `JWT_SECRET` - Secret key for JWT tokens (production)

### Optional Variables
- `CORS_ORIGINS` - Comma-separated list of allowed origins
- `VITE_API_URL` - Backend API URL for client
- `VITE_WS_URL` - WebSocket URL for client

## Docker Files

### Development Dockerfiles
- `agents-service/Dockerfile.dev` - Hot reload enabled
- `backend/Dockerfile.dev` - Hot reload with TypeScript watch
- `client-pwa/Dockerfile.dev` - Vite dev server

### Production Dockerfiles
- `agents-service/Dockerfile.prod` - Multi-stage, optimized, non-root user
- `backend/Dockerfile.prod` - Multi-stage, optimized, non-root user
- `client-pwa/Dockerfile.prod` - Multi-stage, Nginx serving static files

## Best Practices Implemented

1. **Multi-stage builds** - Smaller production images
2. **Layer caching** - Dependencies installed before code copy
3. **Non-root users** - Enhanced security in production
4. **Health checks** - Proper service orchestration
5. **Docker networks** - Isolated service communication
6. **Volume management** - Persistent data storage
7. **Environment profiles** - Separate dev/prod configurations
8. **.dockerignore** - Reduced build context size

## Troubleshooting

### Services won't start
```bash
# Check service status
docker compose ps

# View service logs
docker compose logs <service-name>
```

### Database connection issues
```bash
# Ensure database is healthy
docker compose exec postgres pg_isready -U house_scanner

# Reset database
docker compose down -v
docker compose --profile dev up -d
```

### Port conflicts
```bash
# Check what's using the port
lsof -i :3000

# Change port mapping in docker-compose.yml
ports:
  - "3001:3000"  # Map to different host port
```

### Clean rebuild
```bash
# Remove everything and rebuild
docker compose down -v
docker compose --profile dev build --no-cache
docker compose --profile dev up -d
```

## Development Workflow

1. **Start infrastructure:**
   ```bash
   docker compose up -d postgres redis minio
   ```

2. **Run services locally** (outside Docker) for faster development
   ```bash
   cd backend && npm run start:dev
   cd agents-service && python -m app.main
   cd client-pwa && npm run dev
   ```

3. **Or run everything in Docker:**
   ```bash
   docker compose --profile dev up -d
   ```

## Production Deployment

1. **Set environment variables in `.env`**
2. **Build production images:**
   ```bash
   docker compose --profile prod build
   ```

3. **Start services:**
   ```bash
   docker compose --profile prod up -d
   ```

4. **Run database migrations:**
   ```bash
   docker compose exec backend-prod npx prisma migrate deploy
   ```

5. **Monitor logs:**
   ```bash
   docker compose logs -f
   ```
