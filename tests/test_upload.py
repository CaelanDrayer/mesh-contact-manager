import io
import json


def test_upload_valid_json(client, csrf_token):
    """Upload valid contacts JSON - expect 200 with correct count."""
    contacts = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
    payload = json.dumps({"contacts": contacts}).encode("utf-8")

    response = client.post(
        "/api/upload",
        data={"file": (io.BytesIO(payload), "contacts.json")},
        content_type="multipart/form-data",
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["total"] == 2
    assert data["filename"] == "contacts.json"
    assert len(data["contacts"]) == 2


def test_upload_invalid_json(client, csrf_token):
    """Upload malformed JSON - expect 400."""
    response = client.post(
        "/api/upload",
        data={"file": (io.BytesIO(b"not valid json {{{{"), "bad.json")},
        content_type="multipart/form-data",
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 400
    assert "error" in response.get_json()


def test_upload_missing_file(client, csrf_token):
    """POST with no file field - expect 400."""
    response = client.post(
        "/api/upload",
        data={},
        content_type="multipart/form-data",
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data


def test_upload_missing_contacts_key(client, csrf_token):
    """Upload JSON without 'contacts' key - expect 400."""
    payload = json.dumps({"nodes": []}).encode("utf-8")

    response = client.post(
        "/api/upload",
        data={"file": (io.BytesIO(payload), "data.json")},
        content_type="multipart/form-data",
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data


def test_upload_contacts_not_list(client, csrf_token):
    """Upload JSON with contacts as a string instead of array - expect 400."""
    payload = json.dumps({"contacts": "not a list"}).encode("utf-8")

    response = client.post(
        "/api/upload",
        data={"file": (io.BytesIO(payload), "data.json")},
        content_type="multipart/form-data",
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data
