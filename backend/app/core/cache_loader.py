import json
from pathlib import Path

async def preload_static_assets(redis):
    base_dir = Path(__file__).resolve().parents[3]
    assets_dir = base_dir / "backend-assets"

    with open(assets_dir / "question_base.json") as f:
        qb = json.load(f)
        await redis.set("static:question_base", json.dumps(qb))

    with open(assets_dir / "knowledge_base.json") as f:
        kb = json.load(f)
        await redis.set("static:knowledge_base", json.dumps(kb))
