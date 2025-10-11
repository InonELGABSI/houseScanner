# HouseCheck API v2.0

Advanced house inspection and scanning service built with FastAPI and clean architecture principles.

## Features

- 🏠 **Comprehensive Analysis**: 6-agent AI pipeline for house, room, and product evaluation
- 🖼️ **Multi-Modal Processing**: Support for image URLs and local demo images
- 📊 **Smart Caching**: Redis-based caching with graceful fallback
- 🏗️ **Clean Architecture**: Domain-driven design with clear separation of concerns
- 🚀 **High Performance**: Async FastAPI with optimized image processing
- 🔄 **Flexible Deployment**: Docker support and multiple environment configurations

## Architecture

### Clean Architecture Structure

```
app/
├── main.py                 # FastAPI application entry point
├── api/v1/                 # API layer
│   ├── routes_scan.py      # POST /v1/scan/run (URLs + custom)
│   ├── routes_simulate.py  # GET /v1/simulate (local demo)
│   └── schemas.py          # API request/response models
├── core/                   # Core configuration
│   ├── settings.py         # Environment settings
│   ├── deps.py             # Dependency injection
│   └── lifespan.py         # Application lifecycle
├── application/            # Use cases and services
│   ├── use_cases/
│   │   ├── run_scan.py     # Scan orchestration
│   │   └── run_simulation.py # Simulation orchestration
│   └── services/
│       ├── preprocess.py   # Image preprocessing
│       ├── aggregation.py  # Result aggregation
│       └── cost_manager.py # Token usage tracking
├── domain/                 # Business logic
│   ├── entities.py         # Domain entities
│   └── policies.py         # Business rules
└── infrastructure/         # External concerns
    ├── cache/redis_cache.py     # Caching layer
    ├── storage/
    │   ├── localfs.py      # Local file operations
    │   └── fetch.py        # HTTP image fetching
    ├── loaders/            # JSON checklist loaders
    │   ├── base_house_loader.py
    │   ├── base_rooms_loader.py
    │   ├── base_products_loader.py
    │   └── custom_user_loader.py
    └── llm/                # AI/ML integration
        ├── openai_client.py
        └── agents.py       # 6-agent pipeline
```

### Agent Pipeline

1. **Agent 1**: House type classification from images
2. **Agent 2**: House-level checklist evaluation  
3. **Agent 3**: Room type classification per room
4. **Agent 4**: Room-level checklist evaluation
5. **Agent 5**: Product checklist evaluation per room
6. **Agent 6**: Pros/cons analysis generation

## API Endpoints

### POST /v1/scan/run
Process houses using image URLs with optional custom checklists.

```json
{
  "rooms": [
    {
      "room_id": "kitchen",
      "image_urls": ["https://example.com/image1.jpg", "..."]
    }
  ],
  "user_custom_checklist": {
    "global": [...],
    "house_level": [...],
    "room_level": [...]
  }
}
```

### GET /v1/simulate
Process local demo images with custom user checklist.

```bash
GET /v1/simulate?root=demo_variant
```

### Response Format

Both endpoints return:

```json
{
  "result": {
    "house_types": ["apartment"],
    "house_checklist": {...},
    "rooms": [...],
    "summary": {...},
    "pros_cons": {...}
  },
  "client_summary": {
    "house": {"booleans_true": [...], "categoricals": {...}},
    "rooms": {...},
    "products": {...},
    "pros_cons": {...}
  },
  "cost_info": {...},
  "metadata": {...}
}
```

## Quick Start

### Environment Setup

1. **Create environment file**:
```bash
cp .env.example .env
```

2. **Configure required variables**:
```env
OPENAI_API_KEY=your_openai_api_key
REDIS_URL=redis://localhost:6379
DEBUG=true
```

### Installation

```bash
# Install dependencies
pip install -e .

# Or with development tools
pip install -e ".[dev]"
```

### Running the Server

```bash
# Development mode
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or using the CLI
python -m app.main
```

### Using Docker

```bash
# Build image
docker build -t housecheck:latest .

# Run container
docker run -p 8000:8000 --env-file .env housecheck:latest
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | - | **Required** OpenAI API key |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `DEBUG` | `false` | Enable debug mode |
| `HOST` | `0.0.0.0` | Server host |
| `PORT` | `8000` | Server port |
| `MAX_IMAGE_EDGE` | `2048` | Max image dimension |
| `VISION_MODEL` | `gpt-4o-mini` | Vision model name |
| `TEXT_MODEL` | `gpt-4o-mini` | Text model name |

### Checklist Configuration

Place JSON checklist files in the `/data` directory:

- `house_type_checklist.json` - House evaluation criteria
- `rooms_type_checklist.json` - Room evaluation criteria  
- `products_type_checklist.json` - Product evaluation criteria
- `custom_user_checklist.json` - User customizations (simulation)

### Demo Images

Place demo images in `/demo` directory structure:

```
demo/
├── room1/
│   ├── IMG_001.jpg
│   └── IMG_002.jpg
└── room2/
    ├── IMG_003.jpg
    └── IMG_004.jpg
```

## Development

### Code Quality

```bash
# Format code
black app/ tests/

# Sort imports  
isort app/ tests/

# Type checking
mypy app/

# Linting
flake8 app/
```

### Testing

```bash
# Run all tests
pytest

# With coverage
pytest --cov=app --cov-report=html

# Run specific test types
pytest -m unit
pytest -m integration
```

### Pre-commit Hooks

```bash
# Install hooks
pre-commit install

# Run on all files
pre-commit run --all-files
```

## Deployment

### Production Settings

```env
DEBUG=false
ENVIRONMENT=production
REDIS_URL=redis://your-redis-host:6379
CORS_ORIGINS=["https://yourdomain.com"]
```

### Docker Production

```dockerfile
# Use production image
FROM python:3.11-slim as production

# Install production dependencies
COPY pyproject.toml .
RUN pip install -e ".[prod]"

# Copy application
COPY app/ app/
COPY data/ data/
COPY demo/ demo/

# Run with gunicorn
CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

### Health Monitoring

- **Health Check**: `GET /health`
- **Service Status**: `GET /v1/scan/health` & `GET /v1/simulate/health`
- **Available Simulations**: `GET /v1/simulate/available`

## Performance Tuning

### Image Optimization
- Automatic JPEG optimization with quality/size controls
- Smart sampling for classification vs. detailed analysis
- Configurable image processing limits

### Caching Strategy
- Redis caching for checklist data with TTL
- Graceful fallback to in-memory cache if Redis unavailable
- Cache invalidation for dynamic updates

### Rate Limiting
- Token-based pacing to stay within API limits
- Configurable throttling between agent calls
- Request-level usage tracking and cost management

## Migration from v1

Key improvements in v2.0:

1. **FastAPI**: Migrated from Flask for better async support
2. **Clean Architecture**: Proper separation of concerns
3. **Type Safety**: Full Pydantic validation and typing
4. **Caching**: Redis integration with fallback
5. **Error Handling**: Comprehensive error management
6. **Monitoring**: Built-in cost tracking and metrics
7. **Flexibility**: Support for both URL and local image processing

## License

MIT License - see LICENSE file for details.

## Support

For questions and support:
- Create an issue on GitHub
- Check the documentation
- Review the API schemas at `/docs` (when DEBUG=true)