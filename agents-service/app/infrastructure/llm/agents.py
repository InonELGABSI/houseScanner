"""Agents service - adapters for the 6 LLM agents."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Dict, List, Any, Iterable, Optional
import base64

from langchain_core.messages import HumanMessage
from langchain_core.callbacks import BaseCallbackHandler
from pydantic import BaseModel

from app.domain.models import (
    ClassificationInput,
    ChecklistEvaluationInput,
    ProsConsAnalysisInput,
    TypesOutput, 
    ChecklistEvaluationOutput, 
    ProsConsOutput, 
    ConditionalAnswer,
    AgentChecklistItem
)
from app.infrastructure.llm.openai_client import OpenAIClient
from app.core.settings import Settings

logger = logging.getLogger(__name__)

DEFAULT_CONDITION_OPTIONS = ["Poor", "Average", "Good", "Excellent", "N/A"]


class TokenTracker(BaseCallbackHandler):
    """Callback handler for token usage tracking."""
    
    def __init__(self, cost_manager, agent_name: str, model: str):
        self.cost_manager = cost_manager
        self.agent_name = agent_name
        self.model = model
    
    def on_llm_end(self, response, **kwargs):
        try:
            llm_output = getattr(response, "llm_output", None) or {}
            token_usage = llm_output.get("token_usage", {})
            if token_usage and self.cost_manager:
                self.cost_manager.record_usage(
                    prompt_tokens=token_usage.get("prompt_tokens", 0),
                    completion_tokens=token_usage.get("completion_tokens", 0),
                    model=self.model,
                    agent=self.agent_name
                )
        except Exception as e:
            logger.warning(f"Token tracking failed: {e}")


class AgentsService:
    """Service orchestrating all 6 LLM agents with proper async handling."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.openai_client = OpenAIClient(settings)
    
    async def classify_types(
        self,
        input_data: ClassificationInput,
        cost_manager=None
    ) -> TypesOutput:
        """
        Agent 1 & 3: Classify house/room types from images.
        
        Args:
            input_data: Classification input with images, allowed types, and context
            cost_manager: Optional cost tracking manager
            
        Returns:
            TypesOutput with detected types
        """
        task_label = input_data.classification_type
        start_time = time.time()
        logger.info(f"🤖 AGENT CLASSIFICATION START: {task_label}")
        logger.info(f"📊 INPUT: {len(input_data.images)} images | allowed_types: {input_data.allowed_types}")
        
        # Log image sizes for debugging
        image_sizes = [len(img) if isinstance(img, bytes) else len(str(img)) for img in input_data.images]
        logger.debug(f"📸 Image sizes (bytes): {image_sizes}")
        
        try:
            # Prepare images for vision model
            img_parts = self._create_image_parts(input_data.images)
            logger.debug(f"🔄 Prepared {len(img_parts)} image parts for vision model")
            
            # Create prompt
            prompt = (
                f"You are a strict classifier for {task_label}. "
                f"Choose ALL applicable IDs ONLY from this list: {input_data.allowed_types}. "
                f"Return them as a JSON object with key 'types' containing an array of strings."
            )
            
            # Get vision client with structured output
            vision_client = self.openai_client.get_vision_client()
            structured_client = vision_client.with_structured_output(TypesOutput)
            
            # Invoke model with usage tracking
            logger.info(f"🚀 INVOKING {self.settings.VISION_MODEL} for {task_label}")
            logger.debug(f"📝 Prompt: {prompt[:200]}..." if len(prompt) > 200 else f"📝 Prompt: {prompt}")
            
            # Create callback if we have a cost manager
            callbacks = []
            if cost_manager:
                tracker = TokenTracker(cost_manager, task_label, self.settings.VISION_MODEL)
                callbacks.append(tracker)
            
            result = structured_client.invoke([
                HumanMessage(content=[
                    {"type": "text", "text": prompt},
                    *img_parts
                ])
            ], config={"callbacks": callbacks})
            
            logger.info(f"✅ MODEL RESPONSE received for {task_label}")
            
            # Filter results to allowed types
            allowed_set = set(input_data.allowed_types)
            filtered_types = [t for t in result.types if t in allowed_set]
            
            duration = time.time() - start_time
            logger.info(f"✅ AGENT CLASSIFICATION COMPLETE [{task_label}] in {duration:.2f}s")
            logger.info(f"📤 OUTPUT: raw_types={result.types} -> filtered_types={filtered_types}")
            logger.info(f"🎯 RESULT: {len(filtered_types)} valid types detected")
            
            return TypesOutput(types=filtered_types)
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"❌ {task_label} failed after {duration:.2f}s: {e}")
            raise
    
    async def evaluate_checklist(
        self,
        input_data: ChecklistEvaluationInput,
        cost_manager=None
    ) -> ChecklistEvaluationOutput:
        """
        Agent 2, 4 & 5: Evaluate checklist items from images.
        
        Args:
            input_data: Checklist evaluation input with images and checklist items
            cost_manager: Optional cost tracking manager
            
        Returns:
            ChecklistEvaluationOutput with categorized results
        """
        # Convert ChecklistItem models to dict format for processing
        items = [item.model_dump() if hasattr(item, 'model_dump') else item for item in input_data.checklist_items]
        role_label = input_data.task_label
        start_time = time.time()
        logger.info(f"🤖 AGENT CHECKLIST START: {role_label}")
        logger.info(f"📊 INPUT: {len(input_data.images)} images, {len(items)} checklist items")
        
        # Log checklist item details
        item_types = {"boolean": 0, "categorical": 0, "conditional": 0}
        for item in items:
            item_type = item.get("type", "unknown")
            if item_type in item_types:
                item_types[item_type] += 1
        logger.info(f"📋 CHECKLIST BREAKDOWN: {item_types}")
        
        # Log image sizes for debugging
        image_sizes = [len(img) if isinstance(img, bytes) else len(str(img)) for img in input_data.images]
        logger.debug(f"📸 Image sizes (bytes): {image_sizes}")
        
        try:
            # Prepare images
            img_parts = self._create_image_parts(input_data.images)
            
            # Process in batches to manage token limits
            batch_size = self.settings.CHECKLIST_BATCH_SIZE
            accumulated_results = ChecklistEvaluationOutput(
                booleans={},
                categoricals={},
                conditionals={}
            )
            
            total_batches = (len(items) + batch_size - 1) // batch_size
            logger.info(f"📦 BATCH PROCESSING: {len(items)} items -> {total_batches} batches (size={batch_size})")
            
            batch_count = 0
            for batch in self._chunk_list(items, batch_size):
                batch_count += 1
                batch_ids = [item.get("id") for item in batch]
                
                logger.info(f"📦 PROCESSING BATCH {batch_count}/{total_batches}: {len(batch)} items")
                logger.debug(f"🏷️  Batch IDs: {batch_ids}")
                
                # Create batch-specific prompt
                instruction = self._items_to_instruction(batch)
                system_prompt = (
                    f"You are a vision QA agent for {role_label}. "
                    "Analyze the provided images and return a JSON object with keys: "
                    "booleans, categoricals, conditionals. "
                    "Each key maps item IDs to answers ONLY for this batch. "
                    "RULES: include EVERY listed ID exactly once; "
                    "if unsure set boolean false, categorical 'N/A'. "
                    "For conditional items create entry under conditionals: "
                    '{id:{"exists":bool, "condition":Quality|null, "subitems":{subid:Quality,...}|{}}}. '
                    "Allowed Quality values: Poor, Average, Good, Excellent, N/A. "
                    "Do not add extra keys."
                )
                
                human_prompt = (
                    f"BATCH ({batch_count}) items (total {len(batch)}):\n"
                    f"{instruction}\n"
                    f"Return ONLY valid JSON."
                )
                
                # Invoke model with JSON mode and token tracking
                vision_client = self.openai_client.get_vision_client()
                
                logger.info(f"🚀 INVOKING {self.settings.VISION_MODEL} for batch {batch_count}/{total_batches}")
                logger.debug(f"📝 System prompt: {system_prompt[:200]}...")
                logger.debug(f"📝 Human prompt: {human_prompt[:200]}...")
                
                # Create callback if we have a cost manager
                callbacks = []
                if cost_manager:
                    tracker = TokenTracker(cost_manager, f"{role_label}-batch{batch_count}", self.settings.VISION_MODEL)
                    callbacks.append(tracker)
                
                response = vision_client.invoke([
                    HumanMessage(content=[
                        {"type": "text", "text": system_prompt + "\n\n" + human_prompt},
                        *img_parts
                    ])
                ], config={"callbacks": callbacks})
                
                logger.info(f"✅ BATCH {batch_count} MODEL RESPONSE received")
                
                # Parse response
                batch_result = self._parse_checklist_response(response, batch)
                
                logger.info(f"📤 BATCH {batch_count} OUTPUT: "
                           f"booleans={len(batch_result.booleans)}, "
                           f"categoricals={len(batch_result.categoricals)}, "
                           f"conditionals={len(batch_result.conditionals)}")
                
                # Accumulate results
                accumulated_results.booleans.update(batch_result.booleans)
                accumulated_results.categoricals.update(batch_result.categoricals)
                accumulated_results.conditionals.update(batch_result.conditionals)
            
            duration = time.time() - start_time
            logger.info(f"✅ AGENT CHECKLIST COMPLETE [{role_label}] in {duration:.2f}s")
            logger.info(f"📤 FINAL OUTPUT: "
                       f"booleans={len(accumulated_results.booleans)}, "
                       f"categoricals={len(accumulated_results.categoricals)}, "
                       f"conditionals={len(accumulated_results.conditionals)}")
            logger.info(f"🎯 RESULT: {total_batches} batches processed successfully")
            
            return accumulated_results
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"❌ Checklist evaluation failed after {duration:.2f}s: {role_label} - {e}")
            raise
    
    async def analyze_pros_cons(
        self,
        input_data: ProsConsAnalysisInput,
        cost_manager=None
    ) -> ProsConsOutput:
        """
        Agent 6: Generate pros/cons from accumulated issues.
        
        Args:
            input_data: Pros/cons analysis input with issue summaries
            cost_manager: Optional cost tracking manager
            
        Returns:
            Pros and cons analysis
        """
        # Extract issues from the input data
        house_issues = input_data.house_issues
        room_issues = input_data.room_issues
        product_issues = input_data.product_issues
            
        start_time = time.time()
        logger.info("🤖 AGENT PROS/CONS START")
        logger.info(
            f"📊 INPUT: house_issues={len(house_issues)}, "
            f"room_issues={len(room_issues)}, "
            f"product_issues={len(product_issues)}, "
            f"total_issues={len(house_issues) + len(room_issues) + len(product_issues)}"
        )
        
        # Log sample issues for debugging
        if house_issues:
            logger.debug(f"🏠 Sample house issues: {house_issues[:3]}")
        if room_issues:
            logger.debug(f"🚪 Sample room issues: {room_issues[:3]}")
        if product_issues:
            logger.debug(f"📦 Sample product issues: {product_issues[:3]}")
        
        try:
            # Prepare analysis text with truncation for token management
            analysis_text = (
                "Given these deterministic issue lines, produce concise pros/cons "
                "(focus on what's good vs what needs attention):\n\n"
                f"HOUSE:\n" + "\n".join(house_issues[:80]) + "\n\n"
                f"ROOMS:\n" + "\n".join(room_issues[:200]) + "\n\n"
                f"PRODUCTS:\n" + "\n".join(product_issues[:200])
            )
            
            # Get text client with structured output
            text_client = self.openai_client.get_text_client()
            structured_client = text_client.with_structured_output(ProsConsOutput)
            
            # Create callback if we have a cost manager
            callbacks = []
            if cost_manager:
                tracker = TokenTracker(cost_manager, "pros/cons analysis", self.settings.TEXT_MODEL)
                callbacks.append(tracker)
            
            logger.info(f"🚀 INVOKING {self.settings.TEXT_MODEL} for pros/cons analysis")
            logger.debug(f"📝 Analysis text length: {len(analysis_text)} characters")
            logger.debug(f"📝 Analysis preview: {analysis_text[:300]}...")
            
            result = structured_client.invoke(analysis_text, config={"callbacks": callbacks})
            
            logger.info(f"✅ MODEL RESPONSE received for pros/cons")
            
            duration = time.time() - start_time
            logger.info(f"✅ AGENT PROS/CONS COMPLETE in {duration:.2f}s")
            logger.info(f"📤 OUTPUT: pros={len(result.pros)}, cons={len(result.cons)}")
            logger.info(f"🎯 RESULT: Analysis generated from {len(house_issues) + len(room_issues) + len(product_issues)} total issues")
            
            # Log samples of generated pros/cons
            if result.pros:
                logger.debug(f"✅ Sample pros: {result.pros[:2]}")
            if result.cons:
                logger.debug(f"❌ Sample cons: {result.cons[:2]}")
            
            return result
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"❌ Pros/cons analysis failed after {duration:.2f}s: {e}")
            raise
    
    def _create_image_parts(self, images: List[bytes]) -> List[Dict[str, Any]]:
        """Create image parts for multimodal input."""
        return [
            {
                "type": "image_url",
                "image_url": {
                    "url": self._to_data_url(img_bytes),
                    "detail": "low"
                }
            }
            for img_bytes in images
        ]
    
    def _to_data_url(self, img_bytes: bytes, mime: str = "image/jpeg") -> str:
        """Convert image bytes to data URL."""
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        return f"data:{mime};base64,{b64}"
    
    def _items_to_instruction(self, items: List[Dict[str, Any]]) -> str:
        """Convert checklist items to instruction text."""
        lines: List[str] = []
        for item in items:
            item_id = item.get("id", "<unknown>")
            item_type = item.get("type")

            if item_type == "boolean":
                lines.append(f"- {item_id} : boolean")
                continue

            if item_type == "categorical":
                options = self._normalize_allowed_options(item.get("options"))
                option_desc = ", ".join(options) if options else "any"
                lines.append(f"- {item_id} : categorical in {{{option_desc}}}")
                continue

            if item_type == "conditional":
                condition_options = (
                    self._normalize_allowed_options(item.get("condition_options"))
                    or self._normalize_allowed_options(item.get("options"))
                    or DEFAULT_CONDITION_OPTIONS
                )
                condition_desc = "/".join(condition_options)

                subitems = item.get("subitems") or []
                sub_segments: List[str] = []
                for sub in subitems:
                    sub_id = sub.get("id", "<sub>")
                    sub_options = self._normalize_allowed_options(sub.get("options")) or condition_options
                    sub_segments.append(f"{sub_id}:{'/'.join(sub_options)}")
                sub_desc = ", ".join(sub_segments) if sub_segments else "{}"

                lines.append(
                    f"- {item_id} : conditional -> exists:boolean, condition in {{{condition_desc}}}, subitems {{{sub_desc}}}"
                )

        return "\n".join(lines)

    def _normalize_allowed_options(self, options: Optional[List[Any]]) -> Optional[List[str]]:
        """Normalize option strings ensuring consistent formatting."""
        if not options:
            return None

        normalized: List[str] = []
        for opt in options:
            if not isinstance(opt, str):
                continue
            cleaned = opt.strip()
            if cleaned.startswith("\"") and cleaned.endswith("\"") and len(cleaned) >= 2:
                cleaned = cleaned[1:-1].strip()
            if cleaned:
                lower = cleaned.lower()
                if lower not in (item.lower() for item in normalized):
                    normalized.append(cleaned)

        return normalized or None

    def _normalize_option_value(
        self,
        value: Any,
        allowed_options: Optional[List[str]],
    ) -> Optional[str]:
        """Normalize a value against allowed options, falling back safely."""
        candidate: Optional[str] = None
        if isinstance(value, str):
            candidate = value.strip()
            if candidate.startswith("\"") and candidate.endswith("\"") and len(candidate) >= 2:
                candidate = candidate[1:-1].strip()
            if not candidate:
                candidate = None

        if allowed_options:
            normalized_map = {opt.lower(): opt for opt in allowed_options}
            if candidate and candidate.lower() in normalized_map:
                return normalized_map[candidate.lower()]

            for opt in allowed_options:
                if opt.lower() == "n/a":
                    return opt

            return allowed_options[0]

        return candidate or "N/A"
    
    def _parse_checklist_response(
        self,
        response: Any,
        expected_items: List[Dict[str, Any]],
    ) -> ChecklistEvaluationOutput:
        """Parse and normalize checklist response."""
        # Extract text content
        if hasattr(response, "content"):
            if isinstance(response.content, list):
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
        
        # Extract JSON from response
        raw_text = raw_text.strip()
        json_text = raw_text
        
        if "{" in raw_text and "}" in raw_text:
            first = raw_text.find("{")
            last = raw_text.rfind("}")
            json_text = raw_text[first:last+1]
        
        try:
            parsed = json.loads(json_text)
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse error: {e}; raw text (truncated): {raw_text[:200]}")
            parsed = {}
        
        # Normalize results
        result = ChecklistEvaluationOutput(
            booleans={},
            categoricals={},
            conditionals={}
        )

        expected_map: Dict[str, Dict[str, Any]] = {}
        for raw_item in expected_items:
            item_id = raw_item.get("id") if isinstance(raw_item, dict) else None
            if not item_id:
                continue

            normalized_item = dict(raw_item)
            normalized_item["options"] = self._normalize_allowed_options(raw_item.get("options"))
            normalized_item["condition_options"] = self._normalize_allowed_options(
                raw_item.get("condition_options")
            )

            normalized_subitems: List[Dict[str, Any]] = []
            for sub in raw_item.get("subitems") or []:
                if not isinstance(sub, dict):
                    continue
                sub_copy = dict(sub)
                sub_copy["options"] = self._normalize_allowed_options(sub.get("options"))
                normalized_subitems.append(sub_copy)
            normalized_item["subitems"] = normalized_subitems

            expected_map[item_id] = normalized_item

        expected_ids = set(expected_map.keys())
        
        if isinstance(parsed, dict):
            # Process booleans
            booleans = parsed.get("booleans", {})
            if isinstance(booleans, dict):
                result.booleans = {
                    k: bool(v) for k, v in booleans.items()
                    if k in expected_ids
                }
            
            # Process categoricals
            categoricals = parsed.get("categoricals", {})
            if isinstance(categoricals, dict):
                normalized_categoricals: Dict[str, str] = {}
                for k, v in categoricals.items():
                    if k not in expected_ids:
                        continue
                    allowed = expected_map[k].get("options")
                    normalized_categoricals[k] = self._normalize_option_value(v, allowed)
                result.categoricals = normalized_categoricals
            
            # Process conditionals
            conditionals = parsed.get("conditionals", {})
            if isinstance(conditionals, dict):
                for k, v in conditionals.items():
                    if k not in expected_ids or not isinstance(v, dict):
                        continue

                    item_meta = expected_map[k]
                    exists = bool(v.get("exists", False))

                    condition_allowed = (
                        item_meta.get("condition_options")
                        or item_meta.get("options")
                        or DEFAULT_CONDITION_OPTIONS
                    )
                    raw_condition = v.get("condition")
                    normalized_condition = self._normalize_option_value(
                        raw_condition,
                        condition_allowed,
                    )

                    raw_subitems = v.get("subitems")
                    subitem_map = raw_subitems if isinstance(raw_subitems, dict) else {}
                    normalized_subitems: Dict[str, str] = {}
                    for sub_meta in item_meta.get("subitems") or []:
                        sub_id = sub_meta.get("id")
                        if not sub_id:
                            continue
                        sub_allowed = sub_meta.get("options") or condition_allowed
                        normalized_subitems[sub_id] = self._normalize_option_value(
                            subitem_map.get(sub_id),
                            sub_allowed,
                        )

                    result.conditionals[k] = ConditionalAnswer(
                        exists=exists,
                        condition=normalized_condition,
                        subitems=normalized_subitems or None
                    )

        # Ensure defaults and normalize outputs even when model omits entries
        for item_id, item in expected_map.items():
            item_type = item.get("type")

            if item_type == "boolean":
                if item_id not in result.booleans:
                    result.booleans[item_id] = False
                continue

            if item_type == "categorical":
                value = result.categoricals.get(item_id)
                allowed = item.get("options")
                result.categoricals[item_id] = self._normalize_option_value(value, allowed)
                continue

            if item_type == "conditional":
                expected_subitems = item.get("subitems") or []
                existing = result.conditionals.get(item_id)
                condition_allowed = (
                    item.get("condition_options")
                    or item.get("options")
                    or DEFAULT_CONDITION_OPTIONS
                )

                exists_flag = existing.exists if existing else False
                existing_condition = existing.condition if existing else None

                existing_subitems = (
                    existing.subitems if existing and isinstance(existing.subitems, dict) else {}
                )
                normalized_subitems: Dict[str, str] = {}
                for sub in expected_subitems:
                    sub_id = sub.get("id")
                    if not sub_id:
                        continue
                    sub_allowed = sub.get("options") or condition_allowed
                    normalized_subitems[sub_id] = self._normalize_option_value(
                        existing_subitems.get(sub_id),
                        sub_allowed,
                    )

                result.conditionals[item_id] = ConditionalAnswer(
                    exists=exists_flag,
                    condition=self._normalize_option_value(
                        existing_condition,
                        condition_allowed,
                    ),
                    subitems=normalized_subitems or None
                )
        
        return result
    
    def _chunk_list(self, items: List[Any], chunk_size: int) -> Iterable[List[Any]]:
        """Split list into chunks of specified size."""
        for i in range(0, len(items), chunk_size):
            yield items[i:i + chunk_size]
    
    def flatten_answers(self, ans: ChecklistEvaluationOutput) -> Dict[str, Any]:
        """Flatten checklist answers into a single dictionary (matches original server)."""
        flat: Dict[str, Any] = {}
        flat.update(ans.booleans)
        flat.update(ans.categoricals)
        for k, v in ans.conditionals.items():
            flat[k] = {"exists": v.exists, "condition": v.condition, "subitems": v.subitems or {}}
        return flat