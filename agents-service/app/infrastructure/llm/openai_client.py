"""OpenAI client configuration and utilities."""
from __future__ import annotations

import logging
from typing import Optional

from langchain_openai import ChatOpenAI
from langchain_core.messages import BaseMessage

from app.core.settings import Settings

logger = logging.getLogger(__name__)


class OpenAIClient:
    """OpenAI client wrapper with configuration and error handling."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self._vision_client: Optional[ChatOpenAI] = None
        self._text_client: Optional[ChatOpenAI] = None
    
    def get_vision_client(self) -> ChatOpenAI:
        """Get or create vision model client."""
        if self._vision_client is None:
            self._vision_client = ChatOpenAI(
                model=self.settings.VISION_MODEL,
                temperature=0,
                max_retries=6,
                api_key=self.settings.OPENAI_API_KEY,
            )
        return self._vision_client
    
    def get_text_client(self) -> ChatOpenAI:
        """Get or create text model client."""
        if self._text_client is None:
            self._text_client = ChatOpenAI(
                model=self.settings.TEXT_MODEL,
                temperature=0,
                max_retries=6,
                api_key=self.settings.OPENAI_API_KEY,
            )
        return self._text_client
    
    async def invoke_with_tracking(
        self,
        client: ChatOpenAI,
        messages: list[BaseMessage],
        agent_name: str,
        cost_manager = None
    ) -> str:
        """
        Invoke LLM with usage tracking.
        
        Args:
            client: LangChain ChatOpenAI client
            messages: Messages to send
            agent_name: Agent identifier for tracking
            cost_manager: Optional cost manager for usage tracking
            
        Returns:
            Response content as string
        """
        try:
            response = client.invoke(messages)
            
            # Extract usage information if available
            if hasattr(response, 'response_metadata') and response.response_metadata:
                usage = response.response_metadata.get('token_usage', {})
                if usage and cost_manager:
                    cost_manager.record_usage(
                        prompt_tokens=usage.get('prompt_tokens', 0),
                        completion_tokens=usage.get('completion_tokens', 0),
                        model=client.model_name,
                        agent=agent_name
                    )
            
            # Extract content
            if hasattr(response, 'content'):
                if isinstance(response.content, list):
                    # Handle structured content
                    text_parts = []
                    for part in response.content:
                        if isinstance(part, dict) and part.get('type') == 'text':
                            text_parts.append(part.get('text', ''))
                        elif isinstance(part, str):
                            text_parts.append(part)
                    return '\n'.join(text_parts)
                else:
                    return str(response.content)
            
            return str(response)
            
        except Exception as e:
            logger.error(f"OpenAI API call failed for {agent_name}: {e}")
            raise