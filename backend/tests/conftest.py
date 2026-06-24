import os

# Settings are constructed while application modules are imported during collection.
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")
os.environ.setdefault("JWT_SECRET", "test-only-secret-that-is-never-used-in-production")
