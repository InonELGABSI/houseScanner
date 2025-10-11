# Agents Service API - `/v1/scan/run` Request Examples

## Overview

The `/v1/scan/run` endpoint orchestrates the complete Agent 1-6 pipeline for house analysis. This document provides comprehensive examples of what the service expects to receive.

## Flow Architecture

```
Client/Frontend
    │
    ├─ Loads Base Checklists (house_type_checklist.json, rooms_type_checklist.json, products_type_checklist.json)
    ├─ Loads User Custom Checklist (custom_user_checklist.json)
    ├─ Merges Base + Custom → Final Merged Checklists
    │
    └─ Sends Request to Agents Service
            │
            ↓
    POST /v1/scan/run
    {
        rooms: [...],                    // Room IDs + Image URLs
        house_checklist: {...},          // Final merged house checklist
        rooms_checklist: {...},          // Final merged rooms checklist  
        products_checklist: {...}        // Final merged products checklist
    }
            │
            ↓
    Agents Service Pipeline
    ├─ Step 1: Fetch images from URLs
    ├─ Step 2: Preprocess images
    ├─ Step 3: Run Agent 1-6 pipeline
    ├─ Step 4: Aggregate results
    └─ Step 5: Calculate costs
            │
            ↓
    Returns ScanResponse
```

## Request Schema

### Endpoint
```
POST /v1/scan/run
Content-Type: application/json
```

### Request Body Structure

```typescript
{
  rooms: RoomData[],                   // Required: At least 1 room
  house_checklist: object,             // Required: Final merged house checklist
  rooms_checklist: object,             // Required: Final merged rooms checklist
  products_checklist: object           // Required: Final merged products checklist
}
```

### RoomData Schema
```typescript
{
  room_id: string,                     // Unique identifier for the room
  image_urls: string[]                 // Array of image URLs for this room
}
```

---

## Full Request Example

### Minimal Example (1 Room, Merged Checklists)

```json
{
  "rooms": [
    {
      "room_id": "living_room_1",
      "image_urls": [
        "https://example.com/images/living-room-1.jpg",
        "https://example.com/images/living-room-2.jpg"
      ]
    }
  ],
  "house_checklist": {
    "default": {
      "description": "Checklist items relevant to all house types",
      "items": [
        {
          "id": "water_damage",
          "title": "Water Damage",
          "type": "boolean",
          "description": "Check for any signs of water leakage or damage in the house"
        },
        {
          "id": "overall_cleanliness",
          "title": "Overall Cleanliness",
          "type": "categorical",
          "options": ["Poor", "Average", "Good", "Excellent"],
          "description": "Assess general cleanliness of the house"
        },
        {
          "id": "structural_issues",
          "title": "Structural Issues",
          "type": "boolean",
          "description": "Look for cracks, uneven floors, or visible damage in the structure"
        },
        {
          "id": "visible_mold",
          "title": "Visible Mold",
          "type": "boolean",
          "description": "Check for visible mold or mildew on walls, ceilings, or corners"
        }
      ]
    },
    "house_types": {
      "apartment": {
        "description": "Residential unit within a multi-story building",
        "items": [
          {
            "id": "balcony",
            "title": "Balcony",
            "type": "conditional",
            "description": "Check if balcony exists and its condition"
          }
        ]
      }
    }
  },
  "rooms_checklist": {
    "default": {
      "description": "Checklist items relevant to all room types",
      "items": [
        {
          "id": "room_cleanliness",
          "title": "Room Cleanliness",
          "type": "categorical",
          "options": ["Poor", "Average", "Good", "Excellent"],
          "description": "General tidiness and cleanliness of the room"
        },
        {
          "id": "lighting",
          "title": "Lighting",
          "type": "boolean",
          "description": "Check if room lighting fixtures work properly"
        },
        {
          "id": "flooring",
          "title": "Flooring",
          "type": "categorical",
          "options": ["Poor", "Average", "Good", "Excellent"],
          "description": "Check floor type and its condition"
        }
      ]
    },
    "room_types": {
      "living_room": {
        "description": "Common living space for relaxation and entertainment",
        "items": [
          {
            "id": "tv_wall_mount",
            "title": "TV Wall Mount",
            "type": "boolean",
            "description": "Check if TV wall mount exists and is secure"
          }
        ]
      }
    }
  },
  "products_checklist": {
    "description": "Comprehensive list of furniture and appliances",
    "items": [
      {
        "id": "sofa",
        "title": "Sofa / Couch",
        "type": "conditional",
        "description": "Check if a sofa exists; rate overall, upholstery and frame",
        "subitems": [
          {
            "id": "upholstery_condition",
            "title": "Upholstery",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          },
          {
            "id": "frame_condition",
            "title": "Internal Frame / Structure",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          }
        ]
      },
      {
        "id": "tv",
        "title": "Television",
        "type": "conditional",
        "description": "Check if a TV exists; rate overall and screen condition",
        "subitems": [
          {
            "id": "screen_condition",
            "title": "Screen Condition",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          }
        ]
      }
    ]
  }
}
```

---

## Complete Multi-Room Example

```json
{
  "rooms": [
    {
      "room_id": "living_room",
      "image_urls": [
        "https://storage.example.com/scan-123/living-room-1.jpg",
        "https://storage.example.com/scan-123/living-room-2.jpg",
        "https://storage.example.com/scan-123/living-room-3.jpg"
      ]
    },
    {
      "room_id": "kitchen",
      "image_urls": [
        "https://storage.example.com/scan-123/kitchen-1.jpg",
        "https://storage.example.com/scan-123/kitchen-2.jpg"
      ]
    },
    {
      "room_id": "bedroom_master",
      "image_urls": [
        "https://storage.example.com/scan-123/bedroom-1.jpg",
        "https://storage.example.com/scan-123/bedroom-2.jpg"
      ]
    },
    {
      "room_id": "bathroom",
      "image_urls": [
        "https://storage.example.com/scan-123/bathroom-1.jpg"
      ]
    }
  ],
  "house_checklist": {
    "default": {
      "description": "Checklist items relevant to all house types",
      "items": [
        {
          "id": "water_damage",
          "title": "Water Damage",
          "type": "boolean",
          "description": "Check for any signs of water leakage or damage in the house"
        },
        {
          "id": "overall_cleanliness",
          "title": "Overall Cleanliness",
          "type": "categorical",
          "options": ["Poor", "Average", "Good", "Excellent"],
          "description": "Assess general cleanliness of the house"
        },
        {
          "id": "structural_issues",
          "title": "Structural Issues",
          "type": "boolean",
          "description": "Look for cracks, uneven floors, or visible damage in the structure"
        },
        {
          "id": "electrical_system",
          "title": "Electrical System",
          "type": "boolean",
          "description": "Check if all electrical points, switches, and lights are functional"
        },
        {
          "id": "plumbing_system",
          "title": "Plumbing System",
          "type": "boolean",
          "description": "Check if water taps, drains, and pipes are functional"
        },
        {
          "id": "pest_issues",
          "title": "Pest Issues",
          "type": "boolean",
          "description": "Check for any signs of rodents, insects, or other pests"
        },
        {
          "id": "visible_mold",
          "title": "Visible Mold",
          "type": "boolean",
          "description": "Check for visible mold or mildew on walls, ceilings, or corners"
        },
        {
          "id": "paint_condition",
          "title": "Paint Condition",
          "type": "categorical",
          "options": ["Peeling", "Stained", "Good", "Fresh"],
          "description": "Assess the condition of visible wall/ceiling paint"
        }
      ]
    },
    "house_types": {
      "apartment": {
        "description": "Residential unit within a multi-story building",
        "items": [
          {
            "id": "balcony",
            "title": "Balcony",
            "type": "conditional",
            "description": "Check if balcony exists and its condition",
            "subitems": [
              {
                "id": "balcony_condition",
                "title": "Balcony Condition",
                "type": "categorical",
                "options": ["Poor", "Average", "Good", "Excellent"]
              }
            ]
          },
          {
            "id": "elevator",
            "title": "Elevator",
            "type": "boolean",
            "description": "Check if building has functional elevator"
          },
          {
            "id": "roof_visibility",
            "title": "Roof Visible Damage",
            "type": "boolean",
            "description": "Check for cracked tiles, holes, or missing roof elements"
          }
        ]
      },
      "house": {
        "description": "Standalone residential structure",
        "items": [
          {
            "id": "garden",
            "title": "Garden",
            "type": "conditional",
            "description": "Check if garden exists and its condition"
          },
          {
            "id": "garage",
            "title": "Garage",
            "type": "boolean",
            "description": "Check if garage exists and is functional"
          }
        ]
      }
    }
  },
  "rooms_checklist": {
    "default": {
      "description": "Checklist items relevant to all room types",
      "items": [
        {
          "id": "room_cleanliness",
          "title": "Room Cleanliness",
          "type": "categorical",
          "options": ["Poor", "Average", "Good", "Excellent"],
          "description": "General tidiness and cleanliness of the room"
        },
        {
          "id": "structural_issues",
          "title": "Structural Issues",
          "type": "boolean",
          "description": "Check for cracks, uneven floors, or any structural damage"
        },
        {
          "id": "lighting",
          "title": "Lighting",
          "type": "boolean",
          "description": "Check if room lighting fixtures work properly"
        },
        {
          "id": "windows",
          "title": "Windows",
          "type": "conditional",
          "description": "Check if windows exist and their condition",
          "subitems": [
            {
              "id": "windows_condition",
              "title": "Windows Condition",
              "type": "categorical",
              "options": ["Poor", "Average", "Good", "Excellent"],
              "description": "Assess frames, glass, locks, and insulation"
            }
          ]
        },
        {
          "id": "flooring",
          "title": "Flooring",
          "type": "categorical",
          "options": ["Poor", "Average", "Good", "Excellent"],
          "description": "Check floor type and its condition"
        }
      ]
    },
    "room_types": {
      "bedroom": {
        "description": "Sleeping quarters with bed and storage",
        "items": [
          {
            "id": "closet",
            "title": "Closet",
            "type": "conditional",
            "description": "Check if closet exists and its condition"
          },
          {
            "id": "curtains",
            "title": "Curtains / Blinds Condition",
            "type": "categorical",
            "options": ["Missing", "Poor", "Average", "Good", "Excellent"],
            "description": "Check if curtains or blinds exist and their condition"
          }
        ]
      },
      "kitchen": {
        "description": "Food preparation area with appliances",
        "items": [
          {
            "id": "ventilation",
            "title": "Ventilation",
            "type": "boolean",
            "description": "Check if kitchen has proper ventilation or exhaust fan"
          },
          {
            "id": "countertop_condition",
            "title": "Countertop Condition",
            "type": "categorical",
            "options": ["Cracked", "Stained", "Good", "Excellent"],
            "description": "Check if kitchen countertop surface is in good shape"
          }
        ]
      },
      "bathroom": {
        "description": "Sanitary facilities with plumbing fixtures",
        "items": [
          {
            "id": "shower",
            "title": "Shower",
            "type": "conditional",
            "description": "Check if shower exists and its condition"
          },
          {
            "id": "mirror_condition",
            "title": "Mirror Condition",
            "type": "categorical",
            "options": ["Cracked", "Stained", "Good", "Excellent"],
            "description": "Check if bathroom mirrors are intact and clean"
          }
        ]
      },
      "living_room": {
        "description": "Common living space for relaxation and entertainment",
        "items": [
          {
            "id": "tv_wall_mount",
            "title": "TV Wall Mount",
            "type": "boolean",
            "description": "Check if TV wall mount exists and is secure"
          }
        ]
      }
    }
  },
  "products_checklist": {
    "description": "Comprehensive list of furniture and appliances for all room types",
    "items": [
      {
        "id": "bed",
        "title": "Bed",
        "type": "conditional",
        "description": "Check if a bed exists; rate overall and frame condition",
        "subitems": [
          {
            "id": "frame_condition",
            "title": "Bed Frame",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          }
        ]
      },
      {
        "id": "mattress",
        "title": "Mattress",
        "type": "conditional",
        "description": "Check if a mattress exists; rate overall and surface/wear",
        "subitems": [
          {
            "id": "mattress_surface",
            "title": "Surface / Wear",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          }
        ]
      },
      {
        "id": "sofa",
        "title": "Sofa / Couch",
        "type": "conditional",
        "description": "Check if a sofa exists; rate overall, upholstery and frame",
        "subitems": [
          {
            "id": "upholstery_condition",
            "title": "Upholstery",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          },
          {
            "id": "frame_condition",
            "title": "Internal Frame / Structure",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          }
        ]
      },
      {
        "id": "dining_table",
        "title": "Dining Table",
        "type": "conditional",
        "description": "Check if dining table exists; rate overall and surface condition",
        "subitems": [
          {
            "id": "surface_condition",
            "title": "Table Surface",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          }
        ]
      },
      {
        "id": "chairs",
        "title": "Chairs",
        "type": "conditional",
        "description": "Check if chairs exist; rate overall and stability",
        "subitems": [
          {
            "id": "stability",
            "title": "Stability / Structure",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          }
        ]
      },
      {
        "id": "wardrobe",
        "title": "Wardrobe / Closet",
        "type": "conditional",
        "description": "Check if wardrobe exists; rate overall and doors/hinges",
        "subitems": [
          {
            "id": "doors_hinges",
            "title": "Doors / Hinges",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          }
        ]
      },
      {
        "id": "tv",
        "title": "Television",
        "type": "conditional",
        "description": "Check if a TV exists; rate overall and screen condition",
        "subitems": [
          {
            "id": "screen_condition",
            "title": "Screen Condition",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          }
        ]
      },
      {
        "id": "fridge",
        "title": "Refrigerator",
        "type": "conditional",
        "description": "Check if fridge exists; rate overall and cooling/door",
        "subitems": [
          {
            "id": "cooling_performance",
            "title": "Cooling Performance",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          },
          {
            "id": "door_condition",
            "title": "Fridge Door Condition",
            "type": "categorical",
            "options": ["Dented", "Stained", "Good", "Excellent", "N/A"],
            "description": "Check fridge door appearance for dents or rust"
          }
        ]
      },
      {
        "id": "oven",
        "title": "Oven / Stove",
        "type": "conditional",
        "description": "Check if oven exists; rate overall and heating/cleanliness",
        "subitems": [
          {
            "id": "heating_functionality",
            "title": "Heating Functionality",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          },
          {
            "id": "cleanliness",
            "title": "Cleanliness",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          }
        ]
      },
      {
        "id": "washing_machine",
        "title": "Washing Machine",
        "type": "conditional",
        "description": "Check if washing machine exists; rate overall and functionality",
        "subitems": [
          {
            "id": "functionality",
            "title": "Functionality",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          }
        ]
      },
      {
        "id": "dishwasher",
        "title": "Dishwasher",
        "type": "conditional",
        "description": "Check if dishwasher exists; rate overall and functionality",
        "subitems": [
          {
            "id": "functionality",
            "title": "Functionality",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          }
        ]
      },
      {
        "id": "microwave",
        "title": "Microwave",
        "type": "conditional",
        "description": "Check if microwave exists; rate overall and functionality",
        "subitems": [
          {
            "id": "functionality",
            "title": "Functionality",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          }
        ]
      },
      {
        "id": "air_conditioner",
        "title": "Air Conditioner",
        "type": "conditional",
        "description": "Check if AC exists; rate overall and cooling performance",
        "subitems": [
          {
            "id": "cooling_performance",
            "title": "Cooling Performance",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          }
        ]
      },
      {
        "id": "water_heater",
        "title": "Water Heater",
        "type": "conditional",
        "description": "Check if water heater exists; rate overall and heating performance",
        "subitems": [
          {
            "id": "heating_performance",
            "title": "Heating Performance",
            "type": "categorical",
            "options": ["Poor", "Average", "Good", "Excellent", "N/A"]
          }
        ]
      }
    ]
  }
}
```

---

## Response Structure

The service will return a `ScanResponse` with the following structure:

```json
{
  "result": {
    "house_types": ["apartment"],
    "house_checklists": { ... },
    "rooms": [
      {
        "room_id": "living_room",
        "room_type": "living_room",
        "room_checklist": { ... },
        "products_checklist": { ... }
      }
    ],
    "pros_cons": {
      "pros": ["Good natural lighting", "Modern appliances"],
      "cons": ["Minor water stains in bathroom", "Worn carpet in bedroom"]
    }
  },
  "client_summary": {
    "house_overview": "...",
    "critical_issues": [],
    "recommendations": []
  },
  "cost_info": {
    "tokens": {
      "prompt_tokens": 15420,
      "completion_tokens": 3240,
      "total_tokens": 18660
    },
    "estimated_cost_usd": 0.42
  },
  "metadata": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "execution_time_seconds": 45.23,
    "timestamp": "2025-10-08T10:30:45.123456",
    "total_images": 9,
    "rooms_processed": 4,
    "pipeline_version": "2.0.0"
  }
}
```

---

## Important Notes

### 1. **Client Responsibilities**
- ✅ Load base checklists from JSON files
- ✅ Load user custom checklists  
- ✅ Merge base + custom checklists before sending
- ✅ Upload images and generate public URLs
- ✅ Send final merged checklists to the service

### 2. **Service Responsibilities**
- ✅ Fetch images from provided URLs
- ✅ Preprocess images for optimal analysis
- ✅ Run Agent 1-6 pipeline with provided checklists
- ✅ Aggregate results and generate summaries
- ✅ Calculate token usage and costs

### 3. **The Service Does NOT:**
- ❌ Store or know about base checklists
- ❌ Store or know about custom user checklists
- ❌ Perform any checklist merging logic
- ❌ Store images (uses URLs only)
- ❌ Handle image uploads

### 4. **Validation Rules**
- At least 1 room must be provided
- Each room must have at least 1 image URL
- All checklist objects must be valid JSON
- Image URLs must be publicly accessible
- Image URLs should return valid image formats (JPEG, PNG, etc.)

### 5. **Best Practices**
- Use CDN or cloud storage for image hosting (S3, CloudFront, etc.)
- Ensure images are compressed and optimized (< 5MB per image)
- Use descriptive room_ids that match your data model
- Include multiple angles per room (2-4 images recommended)
- Test image URL accessibility before sending request

---

## Health Check

```bash
GET /v1/scan/health
```

Response:
```json
{
  "service": "scan",
  "status": "healthy",
  "capabilities": [
    "image_url_processing",
    "custom_checklists",
    "full_pipeline"
  ]
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "detail": "At least one room must be provided"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error: <error message>"
}
```

---

## cURL Example

```bash
curl -X POST "http://localhost:8000/v1/scan/run" \
  -H "Content-Type: application/json" \
  -d @request.json
```

Where `request.json` contains the full request body as shown in the examples above.

---

## Testing Tips

1. **Start with minimal example**: Use 1 room and simplified checklists
2. **Validate checklist structure**: Ensure all required fields are present
3. **Test image URLs**: Verify all URLs are accessible before sending
4. **Monitor response time**: Multi-room scans take longer (30-60s typical)
5. **Check cost_info**: Monitor token usage for optimization

---

## Pipeline Version

Current pipeline version: **2.0.0**

This version includes:
- URL-based image fetching
- Pre-merged checklist support
- Full Agent 1-6 pipeline
- Enhanced cost tracking
- Client summary generation
