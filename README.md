# MeshCore Contacts Manager

A local web application for managing [MeshCore](https://github.com/ripplebiz/MeshCore) mesh network contact configuration files. Provides an interactive map-first interface for visualizing, filtering, and selectively pruning contacts from your node's contact list.

Built with Flask + Leaflet.js. No accounts, no cloud, no API keys -- runs entirely on your machine.

## Why

MeshCore nodes accumulate contacts over time. Many become stale, have unknown locations, or are outside your area of interest. Manually editing the JSON config is tedious and error-prone. This tool lets you:

- **See** all your contacts on a real map with type-specific icons
- **Filter** by type, distance, last-seen age, and flags
- **Protect** important contacts from accidental removal
- **Prune** with confidence using visual green/red marker feedback
- **Save** with browser download -- choose where to save

## Quick Start

```bash
# Clone the repository
git clone https://github.com/CaelanDrayer/mesh-contact-manager.git
cd mesh-contact-manager

# Install dependencies (Flask, Gunicorn, pytest, pytest-flask)
pip install -r requirements.txt

# Start the application
python app.py
```

The app opens automatically in your browser at `http://localhost:8080`.

## Usage

1. **Load contacts** -- Drag and drop your MeshCore contacts JSON file onto the drop zone (or click to browse)
2. **Explore the map** -- Contacts appear as colored markers with type-specific icons. Hover for names, click for full details
3. **Apply filters** -- Use the sidebar controls to mark contacts for removal:
   - **Type checkboxes** -- Mark contact types for removal (contacts remain visible as red markers on the map)
   - **Radius filter** -- Click any contact or map location to set a center point, then enter a km radius. Contacts outside the circle turn red
   - **Last seen** -- Remove contacts not heard from in X days
   - **Flags filter** -- Keep only contacts with a specific flag value
   - **Unknown location** -- Keep or remove contacts at 0,0
4. **Protect contacts** -- Use "Always Keep by Flag" to protect contacts with specific flags from all filter removal
5. **Manual override** -- Click any marker's popup button to manually toggle keep/remove, overriding filters
6. **Save** -- Click "Save Kept Contacts" to download the filtered contact list via a browser Save As dialog. Removed contacts are cleared from the map and the list is rebuilt with only kept contacts
7. **Export** -- Click "Export Removed" to download removed contacts to a separate file for reference

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
- Save triggers a browser download dialog (native Save As) -- no server-side file writes
- Export also triggers a browser download dialog
- 2-space indented JSON output for readability
- After saving, removed contacts are cleared from the map and the contact list is rebuilt with only kept contacts
- No modifications to your source file at any point -- all operations are client-side

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

## Security

The application includes multiple layers of security hardening.

**CSRF Protection**

All POST endpoints require a valid CSRF token:

1. Fetch a token: `GET /api/csrf-token` → returns `{"csrf_token": "<hex>"}`
2. Include it on every POST: `X-CSRF-Token: <token>` header
3. Missing or mismatched tokens return `403 Forbidden`

**HTTP Security Headers**

Every response includes:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' https://unpkg.com; img-src 'self' data: https://*.tile.openstreetmap.org; connect-src 'self'` |

**Input Validation**

- Filenames are sanitized with werkzeug's `secure_filename` and validated against `os.path.realpath` to block path traversal attacks (e.g., `../`, absolute paths)
- Contacts payload must be a JSON array; objects or other types are rejected with `400`
- Maximum of 100,000 contacts per request
- Upload size capped at 16 MB by default (configurable via `MAX_CONTENT_LENGTH`)

**Client-Side Protection**

- All contact data is HTML-escaped via `escapeHtml()` before rendering in map popups, preventing XSS injection from malicious contact names or field values
- Leaflet CSS and JavaScript are loaded from the CDN with Subresource Integrity (SRI) hashes (`integrity=` and `crossorigin=` attributes), ensuring the loaded library has not been tampered with

## Testing

The project includes a pytest-based test suite covering all API endpoints and security controls.

**Test files**

| File | Coverage |
|------|----------|
| `tests/conftest.py` | Shared fixtures: Flask test app, HTTP client, CSRF token helper |
| `tests/test_upload.py` | `/api/upload` -- valid JSON, malformed JSON, missing file, bad structure |
| `tests/test_save.py` | `/api/save` -- valid save, path traversal attempts, missing fields, empty filename |
| `tests/test_export.py` | `/api/export` -- valid export, path traversal, missing fields |
| `tests/test_security.py` | Security headers, CSRF token endpoint, CSRF enforcement, `MAX_CONTENT_LENGTH` config |

**Running tests**

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v
```

Tests use `pytest-flask` for the Flask test client and pytest's built-in `tmp_path` fixture for isolated file I/O.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Python 3 + Flask 3.x |
| Frontend | Vanilla HTML/CSS/JS (no build tools) |
| Map | Leaflet.js via CDN + OpenStreetMap tiles |
| Distance | Haversine formula (Python stdlib `math`) |
| Icons | Custom SVG (9 variants: 3 types × 3 colors) |
| Dependencies | `flask>=3.0`, `gunicorn>=21.0`, `pytest>=7.0`, `pytest-flask>=1.0` |

## Project Structure

```
mesh-contact-manager/
├── app.py              # Flask application and API routes
├── config.py           # Configuration loaded from environment variables
├── requirements.txt    # Python dependencies
├── .env.example        # Environment variable template
├── templates/
│   └── index.html      # Single-page frontend
├── static/
│   ├── css/
│   │   └── style.css    # Dark theme, sidebar layout, popup styles
│   ├── js/
│   │   └── app.js       # Map logic, filtering, drag-drop, popups
│   └── icons/           # 9 SVG icons (3 types × 3 colors)
└── tests/
    ├── conftest.py      # pytest fixtures
    ├── test_upload.py   # Upload endpoint tests
    ├── test_save.py     # Save endpoint tests
    ├── test_export.py   # Export endpoint tests
    └── test_security.py # Security and CSRF tests
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Serve the main application UI |
| `GET` | `/api/csrf-token` | Generate and return CSRF token for session |
| `POST` | `/api/upload` | Upload and parse a MeshCore JSON contacts file |
| `POST` | `/api/save` | Save filtered contacts back to disk (with backup) |
| `POST` | `/api/export` | Export a contact subset to a new file |

All `POST` endpoints require a valid `X-CSRF-Token` header.

**Note:** The `/api/save` and `/api/export` endpoints are fully functional on the server and available for programmatic or API use. The web UI currently uses client-side browser downloads instead of these endpoints -- Save and Export both trigger a native browser Save As dialog without making a server request.

## Configuration

Configuration is managed through the `Config` class in `config.py`. All values are read from environment variables and fall back to sensible defaults when not set.

Copy `.env.example` to `.env` and customize as needed:

```bash
cp .env.example .env
```

**Environment variables**

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | auto-generated | Flask session secret. Auto-generated at startup if not set -- set explicitly in production so sessions survive restarts. |
| `MAX_CONTENT_LENGTH` | `16777216` (16 MB) | Maximum upload size in bytes. |
| `PORT` | `8080` | Port the server listens on. |
| `DEBUG` | `false` | Enable Flask debug mode. Set `true` only in development. |
| `UPLOAD_DIR` | *(current working directory)* | Directory where saved/exported files are written. |

> **Note:** If `SECRET_KEY` is not set, a new random key is generated each time the app starts, which invalidates existing sessions on restart. Always set an explicit `SECRET_KEY` in production.

## Deployment

**Development**

```bash
python app.py
```

Starts the Flask dev server, opens a browser tab automatically, and respects the `DEBUG` environment variable.

**Production**

Use [gunicorn](https://gunicorn.org/), which is included in `requirements.txt`:

```bash
gunicorn app:app --bind 0.0.0.0:8080
```

Gunicorn does not auto-open a browser, handles multiple worker processes, and is suitable for serving traffic. Adjust workers with `--workers`:

```bash
gunicorn app:app --bind 0.0.0.0:8080 --workers 4
```

Set `SECRET_KEY` in your environment (or a `.env` file loaded by your process manager) before starting so sessions persist across worker restarts.

## License

MIT
