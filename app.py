import json
import os
import secrets
import shutil
import threading
import webbrowser
from math import radians, sin, cos, sqrt, atan2

from flask import Flask, render_template, request, jsonify, session
from werkzeug.utils import secure_filename

from config import Config

app = Flask(__name__)
app.config.from_object(Config)


@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' https://unpkg.com; "
        "style-src 'self' https://unpkg.com; "
        "img-src 'self' data: https://*.tile.openstreetmap.org; "
        "connect-src 'self'"
    )
    return response


@app.before_request
def check_csrf():
    if request.method == "POST":
        token = request.headers.get("X-CSRF-Token", "")
        if not token or token != session.get("csrf_token"):
            return jsonify({"error": "Invalid or missing CSRF token"}), 403


@app.route("/api/csrf-token")
def csrf_token():
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(32)
    return jsonify({"csrf_token": session["csrf_token"]})


def safe_filepath(directory, filename):
    """Validate filename and ensure path stays within directory."""
    if not filename or ".." in filename or filename.startswith("/"):
        return None
    filename = secure_filename(filename)
    if not filename:
        return None
    filepath = os.path.realpath(os.path.join(directory, filename))
    if not filepath.startswith(os.path.realpath(directory)):
        return None
    return filepath


def validate_contacts(contacts):
    """Validate contacts is a list within size limits."""
    if not isinstance(contacts, list):
        return False
    if len(contacts) > 100000:
        return False
    return True


def haversine_km(lat1, lon1, lat2, lon2):
    """Calculate great-circle distance between two points in kilometers."""
    R = 6371  # Earth radius km
    dlat = radians(float(lat2) - float(lat1))
    dlon = radians(float(lon2) - float(lon1))
    a = sin(dlat / 2) ** 2 + cos(radians(float(lat1))) * cos(radians(float(lat2))) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    try:
        content = file.read().decode("utf-8")
        data = json.loads(content)
    except (UnicodeDecodeError, json.JSONDecodeError):
        return jsonify({"error": "Invalid JSON file"}), 400

    if "contacts" not in data or not isinstance(data["contacts"], list):
        return jsonify({"error": "JSON file must contain a 'contacts' array"}), 400

    if not validate_contacts(data["contacts"]):
        return jsonify({"error": "Invalid contacts data"}), 400

    # Store the original filename for later save/export operations
    session["uploaded_file_dir"] = os.getcwd()

    return jsonify({
        "contacts": data["contacts"],
        "filename": file.filename,
        "total": len(data["contacts"])
    })


@app.route("/api/save", methods=["POST"])
def save():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    contacts = data.get("contacts")
    filename = data.get("filename")
    original_filename = data.get("original_filename")

    if contacts is None or filename is None:
        return jsonify({"error": "Missing 'contacts' or 'filename'"}), 400

    if not validate_contacts(contacts):
        return jsonify({"error": "Invalid contacts data"}), 400

    save_dir = session.get("uploaded_file_dir", os.getcwd())

    # Create backup of the original file if it exists
    if original_filename:
        original_path = safe_filepath(save_dir, original_filename)
        if original_path and os.path.exists(original_path):
            name, ext = os.path.splitext(secure_filename(original_filename))
            backup_path = safe_filepath(save_dir, f"{name}.backup{ext}")
            if backup_path:
                shutil.copy2(original_path, backup_path)

    # Write the kept contacts
    output_path = safe_filepath(save_dir, filename)
    if not output_path:
        return jsonify({"error": "Invalid filename"}), 400
    output_data = {"contacts": contacts}
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)

    return jsonify({"success": True, "count": len(contacts)})


@app.route("/api/export", methods=["POST"])
def export():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    contacts = data.get("contacts")
    filename = data.get("filename")

    if contacts is None or filename is None:
        return jsonify({"error": "Missing 'contacts' or 'filename'"}), 400

    if not validate_contacts(contacts):
        return jsonify({"error": "Invalid contacts data"}), 400

    save_dir = session.get("uploaded_file_dir", os.getcwd())
    output_path = safe_filepath(save_dir, filename)
    if not output_path:
        return jsonify({"error": "Invalid filename"}), 400
    output_data = {"contacts": contacts}

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)

    return jsonify({"success": True, "count": len(contacts)})


if __name__ == "__main__":
    port = app.config.get("PORT", 8080)
    threading.Thread(
        target=lambda: webbrowser.open(f"http://localhost:{port}"),
        daemon=True
    ).start()
    app.run(debug=app.config.get("DEBUG", False), port=port)
