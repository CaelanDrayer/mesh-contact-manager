import json
import os
import shutil
import threading
import webbrowser
from math import radians, sin, cos, sqrt, atan2

from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Track the directory of the last uploaded file
uploaded_file_dir = None


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
    global uploaded_file_dir

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    try:
        content = file.read().decode("utf-8")
        data = json.loads(content)
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        return jsonify({"error": f"Invalid JSON file: {str(e)}"}), 400

    if "contacts" not in data or not isinstance(data["contacts"], list):
        return jsonify({"error": "JSON file must contain a 'contacts' array"}), 400

    # Store the original filename for later save/export operations
    uploaded_file_dir = os.getcwd()

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

    save_dir = uploaded_file_dir or os.getcwd()

    # Create backup of the original file if it exists
    if original_filename:
        original_path = os.path.join(save_dir, original_filename)
        if os.path.exists(original_path):
            name, ext = os.path.splitext(original_filename)
            backup_path = os.path.join(save_dir, f"{name}.backup{ext}")
            shutil.copy2(original_path, backup_path)

    # Write the kept contacts
    output_path = os.path.join(save_dir, filename)
    output_data = {"contacts": contacts}
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)

    return jsonify({
        "success": True,
        "path": output_path,
        "count": len(contacts)
    })


@app.route("/api/export", methods=["POST"])
def export():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    contacts = data.get("contacts")
    filename = data.get("filename")

    if contacts is None or filename is None:
        return jsonify({"error": "Missing 'contacts' or 'filename'"}), 400

    save_dir = uploaded_file_dir or os.getcwd()
    output_path = os.path.join(save_dir, filename)
    output_data = {"contacts": contacts}

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)

    return jsonify({
        "success": True,
        "path": output_path,
        "count": len(contacts)
    })


if __name__ == "__main__":
    port = 8080
    threading.Thread(
        target=lambda: webbrowser.open(f"http://localhost:{port}"),
        daemon=True
    ).start()
    app.run(debug=False, port=port)
