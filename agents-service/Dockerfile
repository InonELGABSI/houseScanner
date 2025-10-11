# Multi-stage Docker build for HouseCheck API

# Build stage
FROM python:3.11-slim as builder

# Install system dependencies for building
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python build dependencies
RUN pip install --no-cache-dir hatchling

# Copy source code
WORKDIR /build
COPY pyproject.toml README.md ./
COPY app/ app/

# Build wheel
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /wheels .

# Production stage
FROM python:3.11-slim as production

# Create non-root user
RUN groupadd --gid 1000 app && \
    useradd --uid 1000 --gid app --shell /bin/bash --create-home app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy wheels and install
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/*.whl && \
    rm -rf /wheels

# Copy application data
COPY --chown=app:app data/ data/
COPY --chown=app:app demo/ demo/

# Create logs directory
RUN mkdir -p logs && chown app:app logs

# Switch to non-root user
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Expose port
EXPOSE 8000

# Default command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# Development stage (extends production)
FROM production as development

# Switch back to root for development tools
USER root

# Install development dependencies
RUN pip install --no-cache-dir \
    pytest>=8.3.0 \
    pytest-asyncio>=0.23.0 \
    black>=24.8.0 \
    isort>=5.12.0 \
    mypy>=1.11.0 \
    httpx>=0.25.0

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Switch back to app user
USER app

# Development command with hot reload
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]