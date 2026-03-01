# MeshCore Contacts Manager - Implementation Brief

## Mission
Build a local web application (Flask + Leaflet.js) for managing MeshCore mesh network contact configuration JSON files. The app provides an interactive map-first interface for visualizing, filtering, and selectively removing contacts.

## Success Criteria
1. User can drag & drop a MeshCore contacts JSON file to load it
2. All contacts render on an interactive OpenStreetMap with type-specific icons
3. Sidebar filters work: type checkboxes, radius from selected contact (with circle overlay), last-seen age, flags
4. Markers are green (keep) or red (remove) with real-time stats
5. Individual markers can be manually toggled to override filters
6. Save creates a backup and writes modified JSON (2-space indent)
7. Export removed contacts to separate file is available
8. App auto-opens browser on `python app.py`

## Architecture

### Tech Stack
- **Backend**: Python + Flask (lightweight local server)
- **Frontend**: HTML + vanilla JS (no build tools)
- **Map**: Leaflet.js via CDN (free, no API key, OpenStreetMap tiles)
- **Distance**: Haversine formula (stdlib math only)
- **Dependencies**: flask (single pip install)

### File Structure
```
meshcore/
├── app.py                  # Flask app, API endpoints, haversine calc
├── templates/
│   └── index.html          # Main page (Leaflet map + sidebar)
├── static/
│   ├── css/
│   │   └── style.css       # Sidebar layout, map styling
│   ├── js/
│   │   └── app.js          # Map logic, filtering, drag-drop, markers
│   └── icons/
│       ├── repeater.png    # Tower icon (type 2)
│       ├── client.png      # Device icon (type 1)
│       └── room.png        # Chat icon (type 3)
└── requirements.txt        # flask
```

### Data Model (MeshCore Contact JSON)
```json
{
  "contacts": [
    {
      "type": 2,              // 1=client, 2=repeater, 3=room
      "name": "VA7WT-NV-R2",
      "custom_name": null,
      "public_key": "a95de366add34a9dfcba6e35d74a49dd8d19b880baf0b7af9d14fcf0db7b5f3c",
      "flags": 1,             // 0 or 1
      "latitude": "49.31746", // string, "0.0" = unknown
      "longitude": "-123.0486",
      "last_advert": 1772311594,
      "last_modified": 1772310948,
      "out_path": ""          // string or null
    }
  ]
}
```

### Contact Types & Map Icons
| Type | Value | Icon | Color (keep) | Color (remove) |
|------|-------|------|-------------|---------------|
| Client | 1 | device/phone | green | red |
| Repeater | 2 | tower/antenna | green | red |
| Room | 3 | chat bubble | green | red |
| Center | - | highlighted | blue | - |

### API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Serve main HTML page |
| POST | `/api/upload` | Receive uploaded JSON, parse, validate, return contacts + stats |
| POST | `/api/save` | Save modified contacts JSON with backup |
| POST | `/api/export` | Export removed contacts to separate file |

## UI Layout
```
┌─────────────────┬──────────────────────────────────┐
│  Sidebar (300px) │  Leaflet Map (fill remaining)    │
│  ┌─────────────┐ │                                  │
│  │ Drag & Drop │ │  Contacts rendered as markers    │
│  │ Zone        │ │  with type-specific icons        │
│  ├─────────────┤ │                                  │
│  │ FILTERS     │ │  Click marker = select as center │
│  │ □ Repeater  │ │  OR view details / toggle state  │
│  │ □ Client    │ │                                  │
│  │ □ Room      │ │  Radius circle drawn when active │
│  │             │ │                                  │
│  │ Radius: _km │ │                                  │
│  │ Center: ... │ │                                  │
│  │             │ │                                  │
│  │ Last seen:  │ │                                  │
│  │  _ days     │ │                                  │
│  │             │ │                                  │
│  │ Flags: 0/1  │ │                                  │
│  │             │ │──────────────────────────────────│
│  │ Unknown loc │ │  Stats: 330 total                │
│  │ [keep/rm]   │ │  Keeping: 280 | Removing: 50    │
│  ├─────────────┤ │                                  │
│  │ [Save]      │ │                                  │
│  │ [Export RM] │ │                                  │
│  └─────────────┘ │                                  │
└─────────────────┴──────────────────────────────────┘
```

## Filter Logic
```
contact is REMOVED if ANY of these are true:
  - contact.type is unchecked in type filter
  - radius active AND distance(contact, center) > radius_km
    AND contact is NOT unknown-location (unless user chose to include)
  - last_seen active AND (now - last_advert) > threshold_days
  - flags filter active AND contact.flags != selected_value

Manual toggle overrides all filter decisions per-contact.
```

## Key Algorithm: Haversine Distance
```python
from math import radians, sin, cos, sqrt, atan2

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius km
    dlat = radians(float(lat2) - float(lat1))
    dlon = radians(float(lon2) - float(lon1))
    a = sin(dlat/2)**2 + cos(radians(float(lat1))) * cos(radians(float(lat2))) * sin(dlon/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))

def has_unknown_location(contact):
    return contact["latitude"] == "0.0" and contact["longitude"] == "0.0"
```

## User Flow
1. `python app.py` → browser opens to localhost:5000
2. Drag & drop contacts JSON file onto the page
3. Map renders all contacts with type icons, auto-zooms to fit
4. Adjust filters in sidebar → markers update green/red in real-time
5. Click markers to inspect details or manually toggle keep/remove
6. Click "Save" → enter filenames for output + backup → file saved
7. Optionally click "Export Removed" → removed contacts saved separately

## Safety
- Auto-backup before any save (user chooses backup filename)
- Visual map confirmation (green=keep, red=remove)
- Manual per-contact override
- Export removed contacts for potential re-import
- Real-time stats bar

## Implementation Checklist
1. Flask app skeleton (`app.py`) with routes and static serving
2. `requirements.txt` with flask
3. HTML template (`templates/index.html`) - page structure, Leaflet CDN imports
4. CSS (`static/css/style.css`) - sidebar + map layout
5. JS (`static/js/app.js`) - drag-drop, map init, markers, filters, save/export
6. SVG marker icons (`static/icons/`) - repeater, client, room in green/red/blue variants
7. Backend: `/api/upload` - parse JSON, validate contacts, return data
8. Backend: `/api/save` - backup original, write modified JSON
9. Backend: `/api/export` - write removed contacts JSON
10. Frontend: drag-drop file upload with visual feedback
11. Frontend: Leaflet map with OSM tiles, auto-fit bounds
12. Frontend: type-specific marker rendering with custom icons
13. Frontend: sidebar filter controls (type checkboxes, radius input, last-seen, flags, unknown-loc)
14. Frontend: click-to-select center contact for radius filter
15. Frontend: radius circle overlay (L.circle)
16. Frontend: marker state management (green/red coloring, manual toggle)
17. Frontend: stats bar with real-time keeping/removing counts
18. Frontend: contact detail popup on marker click
19. Auto-open browser on app start (webbrowser.open)

## Sample Data Reference
File: `VA7WT-ikoka_contacts_config_2026-02-28-170830.json` (~330 contacts)
- Mostly type 2 (repeaters), few type 1 (clients), rare type 3 (rooms)
- Pacific Northwest region (lat ~47-50, lon ~-122 to -124)
- Many contacts have "0.0"/"0.0" (unknown location)
