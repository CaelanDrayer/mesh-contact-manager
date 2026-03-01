# MeshCore Contacts Manager

A local web application for managing [MeshCore](https://github.com/ripplebiz/MeshCore) mesh network contact configuration files. Provides an interactive map-first interface for visualizing, filtering, and selectively pruning contacts from your node's contact list.

Built with Flask + Leaflet.js. No accounts, no cloud, no API keys -- runs entirely on your machine.

## Why

MeshCore nodes accumulate contacts over time. Many become stale, have unknown locations, or are outside your area of interest. Manually editing the JSON config is tedious and error-prone. This tool lets you:

- **See** all your contacts on a real map with type-specific icons
- **Filter** by type, distance, last-seen age, and flags
- **Protect** important contacts from accidental removal
- **Prune** with confidence using visual green/red marker feedback
- **Save** with automatic backup of the original file

## Quick Start

```bash
# Clone
git clone https://github.com/CaelanDrayer/mesh-contact-manager.git
cd mesh-contact-manager

# Install (only dependency is Flask)
pip install -r requirements.txt

# Run (auto-opens browser)
python app.py
```

The app starts on `http://localhost:8080` and opens your browser automatically.

## Usage

1. **Load contacts** -- Drag and drop your MeshCore contacts JSON file onto the drop zone (or click to browse)
2. **Explore the map** -- Contacts appear as colored markers with type-specific icons. Hover for names, click for full details
3. **Apply filters** -- Use the sidebar controls to mark contacts for removal:
   - **Type checkboxes** -- Show/hide Repeaters, Clients, Rooms
   - **Radius filter** -- Click any contact or map location to set a center point, then enter a km radius. Contacts outside the circle turn red
   - **Last seen** -- Remove contacts not heard from in X days
   - **Flags filter** -- Keep only contacts with a specific flag value
   - **Unknown location** -- Keep or remove contacts at 0,0
4. **Protect contacts** -- Use "Always Keep by Flag" to protect contacts with specific flags from all filter removal
5. **Manual override** -- Click any marker's popup button to manually toggle keep/remove, overriding filters
6. **Save** -- Click "Save Kept Contacts" to write the filtered list (original is backed up automatically)
7. **Export** -- Click "Export Removed" to save removed contacts to a separate file for reference

## Features

### Interactive Map
- OpenStreetMap tiles via Leaflet.js (no API key needed)
- Custom SVG marker icons per contact type (Client, Repeater, Room)
- Green markers = keeping, Red = removing, Blue = radius center
- Hover tooltips show contact names
- Click popups show full details with keep/remove toggle button
- Click anywhere on the map to set a radius filter center point

### Smart Filtering
- **Combined filters** -- Contacts are removed if ANY active filter flags them (OR logic)
- **Always Keep** -- Protect contacts by flag value, immune to all other filters
- **Manual override** -- Per-contact toggle that persists through filter changes
- **Live radius circle** -- Visual circle overlay updates as you type the km value
- **Real-time stats** -- Bottom bar shows total, keeping, and removing counts

### Safe File Handling
- Automatic `.backup.json` of the original before saving
- 2-space indented JSON output for readability
- Export removed contacts separately for potential re-import
- No modifications to source file until you explicitly save

## Contact Types & Icons

| Type | Value | Icon | Description |
|------|-------|------|-------------|
| Client | 1 | Phone/device | End-user devices |
| Repeater | 2 | Tower/antenna | Network repeater nodes |
| Room | 3 | Chat bubble | Chat room endpoints |

Each type has green (keep), red (remove), and blue (center) SVG icon variants.

## MeshCore Contact JSON Format

The app expects the standard MeshCore contacts config format:

```json
{
  "contacts": [
    {
      "type": 2,
      "name": "VA7WT-NV-R2",
      "custom_name": null,
      "public_key": "a95de366add34a9d...",
      "flags": 1,
      "latitude": "49.31746",
      "longitude": "-123.0486",
      "last_advert": 1772311594,
      "last_modified": 1772310948,
      "out_path": ""
    }
  ]
}
```

**Notes:**
- `latitude` and `longitude` are strings; `"0.0"/"0.0"` means unknown location
- `type`: 1 = client, 2 = repeater, 3 = room
- `flags`: integer (commonly 0 or 1)
- `last_advert`: Unix epoch timestamp of last advertisement heard

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Python + Flask |
| Frontend | Vanilla HTML/CSS/JS (no build tools) |
| Map | Leaflet.js via CDN + OpenStreetMap tiles |
| Distance | Haversine formula (Python stdlib math) |
| Icons | Custom SVG (9 variants: 3 types x 3 colors) |
| Dependencies | `flask` (single pip install) |

## Project Structure

```
meshcore/
├── app.py                    # Flask server, API endpoints, haversine calc
├── requirements.txt          # flask
├── templates/
│   └── index.html            # Main page with Leaflet CDN imports
├── static/
│   ├── css/
│   │   └── style.css         # Dark theme, sidebar layout, popup styles
│   ├── js/
│   │   └── app.js            # Map logic, filtering, drag-drop, popups
│   └── icons/
│       ├── client-{green,red,blue}.svg
│       ├── repeater-{green,red,blue}.svg
│       └── room-{green,red,blue}.svg
└── DESIGN_BRIEF.md           # Original design specification
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Serve the main HTML page |
| `POST` | `/api/upload` | Parse uploaded JSON, validate, return contacts array |
| `POST` | `/api/save` | Backup original + save filtered contacts |
| `POST` | `/api/export` | Export removed contacts to separate file |

## Configuration

The app runs on port **8080** by default (configurable in `app.py`). It validates coordinate ranges (-90/90 lat, -180/180 lon) and treats 0,0 as unknown location.

## License

MIT
