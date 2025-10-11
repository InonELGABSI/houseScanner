# House Scanner API

A computer vision-powered house inspection system that analyzes images to generate comprehensive property condition reports.

## Features

- 🏠 House type classification (apartment, villa, etc.)
- 🏠 Room type identification (bedroom, kitchen, bathroom, etc.)
- ✅ Automated checklist evaluation using computer vision
- 📊 Condition assessment with ratings
- 📋 Pros/cons summary generation
- 🖼️ Multi-image analysis support

## Quick Start

### 1. Setup

```bash
# Clone and navigate to the project
cd server

# Run setup script
./setup.sh

# Or manual setup:
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your OpenAI API key
```

### 2. Configuration

Edit `.env` file and set your OpenAI API key:

```bash
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. Run the Server

```bash
python app.py
```

The server will start on `http://localhost:8000`

### 4. Test the API

```bash
# Health check
curl http://localhost:8000/health

# Demo simulation (uses demo images)
curl http://localhost:8000/simulate
```

## API Endpoints

### `GET /health`
Health check endpoint.

### `POST /inspect`
Analyze uploaded images with custom checklists.

**Request Body:**
```json
{
  "all_images": [
    {"base64": "base64-encoded-image-data"}
  ],
  "rooms": {
    "room1": [
      {"base64": "base64-encoded-image-data"}
    ]
  },
  "custom_checklist": { /* optional custom checklist */ }
}
```

### `GET /simulate?root=demo`
Run analysis on demo images in the `demo/` folder.

## Project Structure

```
server/
├── app.py              # Main Flask application
├── agents.py           # AI agents for analysis
├── schemas.py          # Pydantic data models
├── utils.py           # Utility functions
├── checklist_loader.py # Checklist management
├── logging_config.py  # Logging setup
├── data/              # Checklist configurations
│   ├── house_type_checklist.json
│   ├── rooms_type_checklist.json
│   ├── products_type_checklist.json
│   └── custom_user_checklist.json
└── demo/              # Demo images
    ├── room1/
    └── room2/
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | OpenAI API key for vision models |
| `PORT` | No | 8000 | Server port |
| `HOST` | No | 0.0.0.0 | Server host |
| `LOG_LEVEL` | No | INFO | Logging level |

## Development

```bash
# Install development dependencies
pip install mypy black flake8 pytest

# Code formatting
black .

# Type checking
mypy .

# Linting
flake8 .
```

## License

This project is for educational/development purposes.
