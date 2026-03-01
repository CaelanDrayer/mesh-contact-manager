import json
import os


def test_save_valid(client, csrf_token, tmp_path):
    """Save contacts with a valid filename - expect success."""
    with client.session_transaction() as sess:
        sess["uploaded_file_dir"] = str(tmp_path)

    contacts = [{"id": 1, "name": "Alice"}]
    response = client.post(
        "/api/save",
        json={"contacts": contacts, "filename": "output.json"},
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["count"] == 1

    saved_file = tmp_path / "output.json"
    assert saved_file.exists()
    saved_data = json.loads(saved_file.read_text())
    assert saved_data["contacts"] == contacts


def test_save_path_traversal_dotdot(client, csrf_token, tmp_path):
    """Try filename with '../' - expect 400 Invalid filename."""
    with client.session_transaction() as sess:
        sess["uploaded_file_dir"] = str(tmp_path)

    response = client.post(
        "/api/save",
        json={"contacts": [], "filename": "../evil.json"},
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 400
    data = response.get_json()
    assert "Invalid filename" in data.get("error", "")


def test_save_path_traversal_absolute(client, csrf_token, tmp_path):
    """Try absolute path filename - expect 400 Invalid filename."""
    with client.session_transaction() as sess:
        sess["uploaded_file_dir"] = str(tmp_path)

    response = client.post(
        "/api/save",
        json={"contacts": [], "filename": "/etc/passwd"},
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 400
    data = response.get_json()
    assert "Invalid filename" in data.get("error", "")


def test_save_missing_fields(client, csrf_token, tmp_path):
    """Missing contacts or filename - expect 400."""
    with client.session_transaction() as sess:
        sess["uploaded_file_dir"] = str(tmp_path)

    # Missing filename
    response = client.post(
        "/api/save",
        json={"contacts": []},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert response.status_code == 400

    # Missing contacts
    response = client.post(
        "/api/save",
        json={"filename": "out.json"},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert response.status_code == 400


def test_save_empty_filename(client, csrf_token, tmp_path):
    """Empty string filename - expect 400 Invalid filename."""
    with client.session_transaction() as sess:
        sess["uploaded_file_dir"] = str(tmp_path)

    response = client.post(
        "/api/save",
        json={"contacts": [], "filename": ""},
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 400
    data = response.get_json()
    assert "Invalid filename" in data.get("error", "")
