from __future__ import annotations
import logging
import time
from typing import Dict, List, Any, Iterable
import json
import os
from io import BytesIO
from PIL import Image
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from schemas import TypesOut, ChecklistAnswers, ProsCons, ConditionalAnswer
from utils import to_data_url
from token_usage import TokenUsageHandler

# Set up agents-specific logger
logger = logging.getLogger("agents")

VISION_MODEL = "gpt-4o-mini"
TEXT_MODEL   = "gpt-4o-mini"

# Environment tunables
MAX_CLASSIFY_IMAGES = int(os.getenv("MAX_CLASSIFY_IMAGES", "4"))
MAX_CHECKLIST_IMAGES = int(os.getenv("MAX_CHECKLIST_IMAGES", "4"))
CLASSIFY_MAX_EDGE = int(os.getenv("CLASSIFY_MAX_EDGE", "512"))
CHECKLIST_MAX_EDGE = int(os.getenv("CHECKLIST_MAX_EDGE", "768"))
CLASSIFY_QUALITY = int(os.getenv("CLASSIFY_QUALITY", "70"))
CHECKLIST_QUALITY = int(os.getenv("CHECKLIST_QUALITY", "80"))
EMPTY_RETRY = int(os.getenv("CHECKLIST_EMPTY_RETRY", "1"))  # number of auto retries if empty output
CHECKLIST_BATCH_SIZE = int(os.getenv("CHECKLIST_BATCH_SIZE", "6"))

def _vision_llm():
    # Increase retries to better handle transient rate limit / timeout errors
    return ChatOpenAI(model=VISION_MODEL, temperature=0, max_retries=6)

def _text_llm():
    return ChatOpenAI(model=TEXT_MODEL, temperature=0, max_retries=6)


def _sample_images_for_classification(images: list[bytes], k: int = 4) -> list[bytes]:
    """Deterministically sample a small subset of images for type classification.

    Strategy: first, two mid points, last. Avoids sending every frame which
    massively inflates prompt tokens for vision models.
    """
    if len(images) <= k:
        return images
    idxs = {0, len(images)//3, (2*len(images))//3, len(images)-1}
    return [images[i] for i in sorted(idxs)]


def _shrink_image_bytes(img_bytes: bytes, max_edge: int, quality: int) -> bytes:
    """Downscale & recompress already-loaded JPEG bytes to further reduce size."""
    try:
        with Image.open(BytesIO(img_bytes)) as im:
            im = im.convert("RGB")
            im.thumbnail((max_edge, max_edge))
            out = BytesIO()
            im.save(out, format="JPEG", optimize=True, quality=quality, progressive=True)
            return out.getvalue()
    except Exception as e:  # pragma: no cover
        logger.debug(f"_shrink_image_bytes failed, returning original: {e}")
        return img_bytes


def _prepare_classification_images(images: List[bytes]) -> List[bytes]:
    sampled = _sample_images_for_classification(images, k=MAX_CLASSIFY_IMAGES)
    return [_shrink_image_bytes(b, CLASSIFY_MAX_EDGE, CLASSIFY_QUALITY) for b in sampled]


def _prepare_checklist_images(images: List[bytes]) -> List[bytes]:
    # Limit number of images for checklist to control prompt size
    if len(images) > MAX_CHECKLIST_IMAGES:
        images = images[:MAX_CHECKLIST_IMAGES]
    return [_shrink_image_bytes(b, CHECKLIST_MAX_EDGE, CHECKLIST_QUALITY) for b in images]


def _image_parts(images: List[bytes], detail: str = "low") -> List[Dict[str, Any]]:
    """Create vision content parts with correct object format and detail setting."""
    return [
        {"type": "image_url", "image_url": {"url": to_data_url(b), "detail": detail}}
        for b in images
    ]


def _chunks(seq: List[Any], n: int) -> Iterable[List[Any]]:
    for i in range(0, len(seq), n):
        yield seq[i:i+n]

# ---------- Agent 1 & 3: classify types ----------
def agent_types_from_images(images: List[bytes], allowed_ids: List[str], task_label: str) -> List[str]:
    """Classify types from images with detailed logging."""
    start_time = time.time()
    logger.info(f"🤖 Starting {task_label} classification")
    logger.debug(f"Input: {len(images)} images, allowed types: {allowed_ids}")
    
    try:
        llm = _vision_llm().with_structured_output(TypesOut)
        # Additional compression path specifically for classification
        prep_images = _prepare_classification_images(images)
        img_parts = [{"type": "image_url", "image_url": {"url": to_data_url(b)}} for b in prep_images]
        total_b64_chars = sum(len(to_data_url(b)) for b in prep_images)
        logger.debug(f"Classification images prepared: {len(prep_images)} (combined data URL chars ~{total_b64_chars})")
        
        prompt = (
            f"You are a strict classifier for {task_label}. "
            f"Choose ALL applicable IDs ONLY from this list: {allowed_ids}. "
            f"Return them under 'types'."
        )
        
        logger.debug(f"Sending request to {VISION_MODEL} with {len(img_parts)} images")
        
        out: TypesOut = llm.invoke(
            [HumanMessage(content=[{"type":"text","text":prompt}, *img_parts])],
            config={"callbacks": [TokenUsageHandler(task_label, VISION_MODEL)]}
        )
        
        # Filter results
        allowed = set(allowed_ids)
        result = [t for t in out.types if t in allowed]
        
        duration = time.time() - start_time
        logger.info(f"✅ {task_label} classification complete in {duration:.2f}s")
        logger.info(f"Raw output: {out.types} -> Filtered: {result}")
        
        return result
        
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"❌ {task_label} classification failed after {duration:.2f}s: {e}")
        raise

# ---------- Agent 2 / 4 / 5: fill checklists ----------
def _items_to_instruction(items: List[Dict[str, Any]]) -> str:
    lines = []
    for it in items:
        t = it["type"]
        if t == "boolean":
            lines.append(f"- {it['id']} : boolean")
        elif t == "categorical":
            opts = ", ".join(it["options"])
            lines.append(f"- {it['id']} : categorical in {{{opts}}}")
        elif t == "conditional":
            sub = it.get("subitems", [])
            subdesc = ", ".join([
                f"{s['id']}:{'/'.join(s.get('options', ['Poor','Average','Good','Excellent','N/A']))}"
                for s in sub
            ])
            lines.append(f"- {it['id']} : conditional -> exists:boolean, condition(optional), subitems {{{subdesc}}}")
    return "\n".join(lines)

def agent_fill_checklist(images: List[bytes], items: List[Dict[str, Any]], role_label: str) -> ChecklistAnswers:
    """Fill checklist with batching, sampling, and robust empty handling.

    NOTE: We previously attempted LangChain structured output tools, but OpenAI's
    function schema validation rejected the nested / dynamic mapping schema
    (400 invalid_function_parameters). We now switch to lightweight JSON mode:
    instruct the model to emit a JSON object and parse it manually. This avoids
    tool schema incompatibilities while retaining batching + token logging.
    """
    start_time = time.time()
    logger.info(f"🤖 Starting checklist evaluation: {role_label}")
    logger.debug(f"Input: {len(images)} raw images, {len(items)} checklist items (batch size={CHECKLIST_BATCH_SIZE})")

    # Composition log
    item_types: Dict[str, int] = {}
    for it in items:
        item_types[it.get("type", "unknown")] = item_types.get(it.get("type", "unknown"), 0) + 1
    logger.debug(f"Checklist composition: {item_types}")

    try:
        prep_images = _prepare_checklist_images(images)
        img_parts = _image_parts(prep_images, detail="low")
        total_b64_chars = sum(len(p["image_url"]["url"]) for p in img_parts)
        logger.debug(f"Checklist images prepared: {len(prep_images)} (combined data URL chars ~{total_b64_chars})")

        acc = ChecklistAnswers(booleans={}, categoricals={}, conditionals={})
        batch_count = 0

        for batch in _chunks(items, CHECKLIST_BATCH_SIZE):
            batch_count += 1
            batch_ids = [b.get("id") for b in batch]
            instr = _items_to_instruction(batch)
            system = (
                f"You are a vision QA agent for {role_label}. Return a JSON object with keys: booleans, categoricals, conditionals. "
                "Each key maps IDs to answers ONLY for this batch. RULES: include EVERY listed ID exactly once; "
                "if unsure set boolean false, categorical 'N/A'. For conditional items create entry under conditionals: {id:{\"exists\":bool, \"condition\":Quality|null, \"subitems\":{subid:Quality,...}|{}}}. "
                "Allowed Quality values: Poor, Average, Good, Excellent, N/A. Do not add extra keys."
            )
            human = f"BATCH ({batch_count}) items (total {len(batch)}):\n{instr}\nReturn ONLY valid JSON."

            llm = _vision_llm()
            logger.debug(f"Batch {batch_count}: invoking model (JSON mode) on items {batch_ids}")
            response = llm.invoke(
                [HumanMessage(content=[{"type": "text", "text": system + "\n\n" + human}, *img_parts])],
                config={"callbacks": [TokenUsageHandler(f"{role_label}/b{batch_count}", VISION_MODEL)]}
            )

            # Extract text content
            if hasattr(response, "content"):
                if isinstance(response.content, list):
                    # LangChain may return list of content parts; concatenate text parts
                    text_parts = []
                    for part in response.content:
                        if isinstance(part, dict) and part.get("type") == "text":
                            text_parts.append(part.get("text", ""))
                        elif isinstance(part, str):
                            text_parts.append(part)
                    raw_text = "\n".join(text_parts)
                else:
                    raw_text = str(response.content)
            else:
                raw_text = str(response)

            raw_text_stripped = raw_text.strip()
            # Attempt to isolate JSON substring
            json_text = raw_text_stripped
            if "{" in raw_text_stripped and "}" in raw_text_stripped:
                first = raw_text_stripped.find("{")
                last = raw_text_stripped.rfind("}")
                json_text = raw_text_stripped[first:last+1]

            try:
                parsed = json.loads(json_text)
            except Exception as pe:
                logger.warning(f"Batch {batch_count} JSON parse failure: {pe}; raw (truncated 250): {raw_text_stripped[:250]}")
                parsed = {}

            # Normalize & merge
            if isinstance(parsed, dict):
                b = parsed.get("booleans") or {}
                c = parsed.get("categoricals") or {}
                cond = parsed.get("conditionals") or {}
                # Basic type filtering
                b = {k: bool(v) for k, v in b.items() if k in batch_ids}
                c = {k: str(v) for k, v in c.items() if k in batch_ids}
                # Conditionals: each value should be dict with exists
                norm_cond = {}
                for k, v in cond.items():
                    if k not in batch_ids or not isinstance(v, dict):
                        continue
                    exists = bool(v.get("exists", False))
                    condition = v.get("condition")
                    subitems = v.get("subitems") if isinstance(v.get("subitems"), dict) else {}
                    norm_cond[k] = ConditionalAnswer(exists=exists, condition=condition, subitems=subitems or None)
                acc.booleans.update(b)
                acc.categoricals.update(c)
                acc.conditionals.update(norm_cond)
            else:
                logger.warning(f"Batch {batch_count} parsed root not dict; ignoring")

        # Empty fallback check
        if not (acc.booleans or acc.categoricals or acc.conditionals):
            logger.warning(f"Checklist result empty after {batch_count} batches for {role_label}; returning empty defaults")

        duration = time.time() - start_time
        logger.info(f"✅ Checklist evaluation complete in {duration:.2f}s: {role_label} (batches={batch_count})")
        logger.debug(f"Response summary: {len(acc.booleans)} booleans, {len(acc.categoricals)} categoricals, {len(acc.conditionals)} conditionals")

        if acc.booleans:
            logger.debug(f"Sample boolean results: {dict(list(acc.booleans.items())[:3])}")
        if acc.categoricals:
            logger.debug(f"Sample categorical results: {dict(list(acc.categoricals.items())[:3])}")

        return acc

    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"❌ Checklist evaluation failed after {duration:.2f}s: {role_label} - {e}")
        raise

# ---------- Agent 6: Pros / Cons ----------
class ProsConsInput(BaseModel):
    house_issues: List[str]
    room_issues: List[str]
    product_issues: List[str]

def agent_pros_cons(house_issues: List[str], room_issues: List[str], product_issues: List[str]) -> ProsCons:
    """Generate pros/cons analysis with detailed logging."""
    start_time = time.time()
    logger.info("🤖 Starting pros/cons analysis")
    logger.debug(f"Input: {len(house_issues)} house issues, {len(room_issues)} room issues, {len(product_issues)} product issues")
    
    try:
        llm = _text_llm().with_structured_output(ProsCons)

        # Prepare text input with truncation for logging
        text = (
            "Given these deterministic issue lines, produce concise pros/cons "
            "(focus on what's good vs what needs attention):\n\n"
            f"HOUSE:\n" + "\n".join(house_issues[:80]) + "\n\n"
            f"ROOMS:\n" + "\n".join(room_issues[:200]) + "\n\n"
            f"PRODUCTS:\n" + "\n".join(product_issues[:200])
        )

        logger.debug(f"Sending pros/cons request to {TEXT_MODEL}")
        logger.debug(f"Input text length: {len(text)} characters")

        result = llm.invoke(text, config={"callbacks": [TokenUsageHandler("pros_cons", TEXT_MODEL)]})

        duration = time.time() - start_time
        logger.info(f"✅ Pros/cons analysis complete in {duration:.2f}s")
        logger.info(f"Generated {len(result.pros)} pros and {len(result.cons)} cons")

        # Log sample results
        if result.pros:
            logger.debug(f"Sample pros: {result.pros[:2]}")
        if result.cons:
            logger.debug(f"Sample cons: {result.cons[:2]}")

        return result

    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"❌ Pros/cons analysis failed after {duration:.2f}s: {e}")
        raise

# ---------- Flatten for summary/ui ----------
def flatten_answers(ans: ChecklistAnswers) -> Dict[str, Any]:
    flat: Dict[str, Any] = {}
    flat.update(ans.booleans)
    flat.update(ans.categoricals)
    for k, v in ans.conditionals.items():
        flat[k] = {"exists": v.exists, "condition": v.condition, "subitems": v.subitems or {}}
    return flat
