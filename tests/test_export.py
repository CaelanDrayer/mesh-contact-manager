import json


def test_export_valid(client, csrf_token, tmp_path):
    """Export contacts to a valid filename - expect success."""
    with client.session_transaction() as sess:
        sess["uploaded_file_dir"] = str(tmp_path)

    contacts = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
    response = client.post(
        "/api/export",
        json={"contacts": contacts, "filename": "export.json"},
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["count"] == 2

    exported_file = tmp_path / "export.json"
    assert exported_file.exists()
    exported_data = json.loads(exported_file.read_text())
    assert exported_data["contacts"] == contacts


def test_export_path_traversal(client, csrf_token, tmp_path):
    """Try '../evil.json' filename - expect 400 Invalid filename."""
    with client.session_transaction() as sess:
        sess["uploaded_file_dir"] = str(tmp_path)

    response = client.post(
        "/api/export",
        json={"contacts": [], "filename": "../evil.json"},
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 400
    data = response.get_json()
    assert "Invalid filename" in data.get("error", "")


def test_export_missing_fields(client, csrf_token, tmp_path):
    """Missing contacts or filename - expect 400."""
    with client.session_transaction() as sess:
        sess["uploaded_file_dir"] = str(tmp_path)

    # Missing filename
    response = client.post(
        "/api/export",
        json={"contacts": []},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert response.status_code == 400

    # Missing contacts
    response = client.post(
        "/api/export",
        json={"filename": "out.json"},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert response.status_code == 400
