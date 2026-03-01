import os


class Config:
    """Application configuration loaded from environment variables."""
    SECRET_KEY = os.environ.get("SECRET_KEY", os.urandom(32).hex())
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_LENGTH", 16 * 1024 * 1024))  # 16MB
    PORT = int(os.environ.get("PORT", 8080))
    DEBUG = os.environ.get("DEBUG", "false").lower() in ("true", "1", "yes")
    UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "")
