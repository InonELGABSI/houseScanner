import json
from pathlib import Path
from typing import Dict, List, Any, Set

DATA_DIR = Path(__file__).parent / "data"

def load_json(name: str) -> Dict:
    with open(DATA_DIR / name, "r", encoding="utf-8") as f:
        return json.load(f)

def load_all():
    house = load_json("house_type_checklist.json")
    rooms = load_json("rooms_type_checklist.json")
    products = load_json("products_type_checklist.json")
    custom_path = DATA_DIR / "custom_user_checklist.json"
    custom = json.loads(custom_path.read_text("utf-8")) if custom_path.exists() else {
        "global": [], "house_level": [], "room_level": [], "product_level": []
    }
    return house, rooms, products, custom

def dedupe_by_id(items: List[Dict]) -> List[Dict]:
    seen: Set[str] = set()
    out: List[Dict] = []
    for it in items:
        _id = it["id"]
        if _id not in seen:
            out.append(it)
            seen.add(_id)
    return out

def merged_house_items(house_json: Dict, predicted_types: List[str], custom: Dict) -> List[Dict]:
    items = list(house_json["default"]["items"])
    for t in predicted_types:
        if t in house_json["house_types"]:
            items += house_json["house_types"][t]["items"]
    items += custom.get("global", [])
    items += custom.get("house_level", [])
    return dedupe_by_id(items)

def merged_room_items(rooms_json: Dict, predicted_room_types: List[str], custom: Dict, room_id: str) -> List[Dict]:
    items = list(rooms_json["default"]["items"])
    for rtype in predicted_room_types:
        cfg = rooms_json["room_types"].get(rtype)
        if cfg:
            items += cfg["items"]
    items += custom.get("global", [])
    for entry in custom.get("room_level", []):
        if entry.get("room_id") == room_id:
            items += entry.get("custom_items", [])
    return dedupe_by_id(items)

def merged_product_items(products_json: Dict, custom: Dict, room_product_whitelist: List[str] | None = None) -> List[Dict]:
    items = list(products_json["items"])
    if room_product_whitelist:
        items = [it for it in items if it["id"] in room_product_whitelist]
    for entry in custom.get("product_level", []):
        pid = entry.get("product_id")
        for new_item in entry.get("custom_items", []):
            cloned = dict(new_item)
            cloned["id"] = f"{pid}__{cloned['id']}"
            items.append(cloned)
    return dedupe_by_id(items)
