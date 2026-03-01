import io
import json


def test_security_headers_present(client):
    """Verify security headers are set on responses."""
    response = client.get("/api/csrf-token")

    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert "Content-Security-Policy" in response.headers


def test_csrf_token_endpoint(client):
    """Verify /api/csrf-token returns a token."""
    response = client.get("/api/csrf-token")

    assert response.status_code == 200
    data = response.get_json()
    assert "csrf_token" in data
    assert len(data["csrf_token"]) > 0


def test_csrf_required_on_post(client):
    """POST without CSRF token should return 403."""
    payload = json.dumps({"contacts": [], "filename": "out.json"}).encode("utf-8")

    response = client.post(
        "/api/upload",
        data={"file": (io.BytesIO(payload), "data.json")},
        content_type="multipart/form-data",
        # No X-CSRF-Token header
    )

    assert response.status_code == 403
    data = response.get_json()
    assert "error" in data


def test_csrf_invalid_token(client):
    """POST with wrong CSRF token should return 403."""
    # First establish a session with a real CSRF token
    client.get("/api/csrf-token")

    payload = json.dumps({"contacts": [], "filename": "out.json"}).encode("utf-8")

    response = client.post(
        "/api/upload",
        data={"file": (io.BytesIO(payload), "data.json")},
        content_type="multipart/form-data",
        headers={"X-CSRF-Token": "totally-wrong-token"},
    )

    assert response.status_code == 403
    data = response.get_json()
    assert "error" in data


def test_max_content_length_configured(app):
    """Verify MAX_CONTENT_LENGTH is configured in the app."""
    assert "MAX_CONTENT_LENGTH" in app.config
    assert app.config["MAX_CONTENT_LENGTH"] is not None
    assert app.config["MAX_CONTENT_LENGTH"] > 0
