"""FastAPI application shell for TextCore."""

from fastapi import FastAPI

app = FastAPI(title="TextCore API")


@app.get("/health")
def health() -> dict[str, str]:
    """Return the API health status."""
    return {"status": "ok"}
