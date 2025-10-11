"""Agent execution tracking service for capturing raw inputs/outputs."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class AgentExecution:
    """Single agent execution record with raw input/output."""
    agent_name: str
    input_data: Dict[str, Any]
    output_data: Dict[str, Any]
    timestamp: str
    model: str
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "agent_name": self.agent_name,
            "input_data": self.input_data,
            "output_data": self.output_data,
            "timestamp": self.timestamp,
            "model": self.model,
        }


class AgentExecutionTracker:
    """Service for tracking agent executions with raw input/output data."""
    
    def __init__(self):
        self._executions: List[AgentExecution] = []
        self._start_time = datetime.utcnow()
    
    def record_execution(
        self,
        agent_name: str,
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        model: str,
    ) -> None:
        """
        Record an agent execution with its raw input/output.
        
        Args:
            agent_name: Name/identifier of the agent
            input_data: Raw input data sent to the agent (prompt, images metadata, etc.)
            output_data: Raw output data received from the agent
            model: Model name used
        """
        execution = AgentExecution(
            agent_name=agent_name,
            input_data=input_data,
            output_data=output_data,
            timestamp=datetime.utcnow().isoformat(),
            model=model,
        )
        self._executions.append(execution)
        
        logger.debug(
            f"📝 AGENT EXECUTION RECORDED [{agent_name}]: "
            f"input_keys={list(input_data.keys())}, "
            f"output_keys={list(output_data.keys())}"
        )
    
    def get_executions(self) -> List[Dict[str, Any]]:
        """Get all recorded executions."""
        return [exec.to_dict() for exec in self._executions]
    
    def get_execution_by_agent(self, agent_name: str) -> List[Dict[str, Any]]:
        """Get executions for a specific agent."""
        return [
            exec.to_dict() 
            for exec in self._executions 
            if exec.agent_name == agent_name
        ]
    
    def get_execution_count(self) -> int:
        """Get total number of executions."""
        return len(self._executions)
    
    def reset(self) -> None:
        """Reset tracking (for new session)."""
        self._executions = []
        self._start_time = datetime.utcnow()
        logger.info("📝 Agent execution tracking reset")
