# HouseScanner Backend API

NestJS-based backend service for the HouseScanner application.

> 🚀 **CI/CD Enabled**: Automated deployments via GitHub Actions

## Features

- 🏗️ **NestJS Framework**: Modern, scalable Node.js framework
- 🔐 **JWT Authentication**: Secure user authentication and authorization
- 📊 **PostgreSQL Database**: Prisma ORM for type-safe database access
- 🗄️ **S3 Storage**: AWS S3 integration for image storage with pre-signed URLs
- 🔄 **Job Queue**: BullMQ for async scan processing with retry logic
- 🔌 **WebSocket Gateway**: Real-time scan progress updates via Socket.IO
- 🐍 **Python Agents Integration**: HTTP client for AI agents service
- ✅ **Health Checks**: Docker health monitoring

## Tech Stack

- **Runtime**: Node.js 20
- **Framework**: NestJS
- **Database**: PostgreSQL 15 (via Prisma)
- **Cache/Queue**: Redis + BullMQ
- **Storage**: AWS S3
- **WebSockets**: Socket.IO
- **Authentication**: JWT + Passport

## Project Structure

```
backend/
├── src/
│   ├── main.ts                  # Application entry point
│   ├── app.module.ts            # Root module
│   ├── auth/                    # Authentication & JWT
│   ├── users/                   # User management
│   ├── scans/                   # Scan orchestration
│   ├── rooms/                   # Room management
│   ├── houses/                  # House management
│   ├── checklists/              # Checklist configuration
│   ├── summaries/               # Scan summaries
│   ├── agents-runs/             # AI agent execution logs
│   ├── infra/                   # Infrastructure
│   │   ├── http/                # HTTP clients (agents-service)
│   │   ├── orm/                 # Prisma database
│   │   ├── storage/             # S3 storage service
│   │   └── queue/               # BullMQ job processing
│   └── common/                  # Shared utilities
└── prisma/
    └── schema.prisma            # Database schema
```

## API Documentation

API documentation is available at `/api/docs` when running the server.

## Deployment

The backend automatically deploys to EC2 when changes are pushed to `main` branch:

1. Docker image is built and pushed to DockerHub
2. EC2 pulls the new image
3. Service restarts with zero-downtime
4. Health checks ensure service is ready

---

**Last Updated**: October 19, 2025
**Port**: 3000
**API Prefix**: `/api/v1`
