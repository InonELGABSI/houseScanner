from __future__ import annotations
import logging
import time
from typing import Dict, List, Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from schemas import TypesOut, ChecklistAnswers, ProsCons
from utils import to_data_url

# Set up agents-specific logger
logger = logging.getLogger("agents")

VISION_MODEL = "gpt-4o-mini"
TEXT_MODEL   = "gpt-4o-mini"

def _vision_llm():
    return ChatOpenAI(model=VISION_MODEL, temperature=0)

def _text_llm():
    return ChatOpenAI(model=TEXT_MODEL, temperature=0)

# ---------- Agent 1 & 3: classify types ----------
def agent_types_from_images(images: List[bytes], allowed_ids: List[str], task_label: str) -> List[str]:
    """Classify types from images with detailed logging."""
    start_time = time.time()
    logger.info(f"🤖 Starting {task_label} classification")
    logger.debug(f"Input: {len(images)} images, allowed types: {allowed_ids}")
    
    try:
        llm = _vision_llm().with_structured_output(TypesOut)
        img_parts = [{"type": "image_url", "image_url": to_data_url(b)} for b in images]
        
        prompt = (
            f"You are a strict classifier for {task_label}. "
            f"Choose ALL applicable IDs ONLY from this list: {allowed_ids}. "
            f"Return them under 'types'."
        )
        
        logger.debug(f"Sending request to {VISION_MODEL} with {len(img_parts)} images")
        
        out: TypesOut = llm.invoke([HumanMessage(content=[{"type":"text","text":prompt}, *img_parts])])
        
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
    """Fill checklist with detailed logging."""
    start_time = time.time()
    logger.info(f"🤖 Starting checklist evaluation: {role_label}")
    logger.debug(f"Input: {len(images)} images, {len(items)} checklist items")
    
    # Log checklist breakdown
    item_types = {}
    for item in items:
        item_type = item.get("type", "unknown")
        item_types[item_type] = item_types.get(item_type, 0) + 1
    logger.debug(f"Checklist composition: {item_types}")
    
    try:
        llm = _vision_llm().with_structured_output(ChecklistAnswers)
        img_parts = [{"type":"image_url", "image_url": to_data_url(b)} for b in images]
        instr = _items_to_instruction(items)
        
        system = (
            f"You are a vision QA agent for {role_label}. "
            f"Answer ONLY using the provided schema. "
            f"For booleans: pick true if condition is present/functional (depending on the item), "
            f"false if clearly absent/failed. If uncertain from images, prefer false.\n"
            f"For categoricals: pick the closest option; 'N/A' only if truly not inferable.\n"
            f"For conditional items: set exists, then condition and relevant subitems if visible."
        )
        human = f"Checklist items:\n{instr}\nReturn JSON strictly."
        
        logger.debug(f"Sending checklist request to {VISION_MODEL}")
        logger.debug(f"Instructions length: {len(instr)} characters")
        
        result = llm.invoke([HumanMessage(content=[{"type":"text","text":system+"\n\n"+human}, *img_parts])])
        
        duration = time.time() - start_time
        logger.info(f"✅ Checklist evaluation complete in {duration:.2f}s: {role_label}")
        
        # Log response summary
        logger.debug(f"Response summary: {len(result.booleans)} booleans, {len(result.categoricals)} categoricals, {len(result.conditionals)} conditionals")
        
        # Log some sample results
        if result.booleans:
            sample_bools = dict(list(result.booleans.items())[:3])
            logger.debug(f"Sample boolean results: {sample_bools}")
        
        if result.categoricals:
            sample_cats = dict(list(result.categoricals.items())[:3])
            logger.debug(f"Sample categorical results: {sample_cats}")
            
        return result
        
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
        
        result = llm.invoke(text)
        
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
