from __future__ import annotations

from pathlib import Path

from PIL import Image


def test_judge_photo_serves_downloaded_image(client, populated_dir):
    photo_dir = Path(populated_dir) / "judge_photos"
    photo_dir.mkdir(parents=True, exist_ok=True)
    photo_path = photo_dir / "sample.jpg"

    Image.new("RGB", (8, 8), color=(80, 100, 120)).save(photo_path, format="JPEG")

    resp = client.get("/api/v1/judge-photo/sample.jpg")

    assert resp.status_code == 200
    assert resp.headers["Content-Type"].startswith("image/jpeg")
    assert len(resp.data) > 20


def test_judge_photo_blocks_path_traversal(client):
    resp = client.get("/api/v1/judge-photo/../cases.csv")
    assert resp.status_code == 404
