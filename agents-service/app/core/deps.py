"""Dependency injection for FastAPI application."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.application.services.cost_manager import CostManager
from app.application.services.agent_tracker import AgentExecutionTracker
from app.infrastructure.cache.redis_cache import RedisCache
from app.infrastructure.llm.agents import AgentsService
from app.infrastructure.loaders.base_house_loader import BaseHouseLoader
from app.infrastructure.loaders.base_rooms_loader import BaseRoomsLoader
from app.infrastructure.loaders.base_products_loader import BaseProductsLoader
from app.infrastructure.loaders.custom_user_loader import CustomUserLoader
from app.infrastructure.storage.localfs import LocalFileStorage
from app.infrastructure.storage.fetch import ImageFetcher
from app.core.settings import get_settings, Settings


# Settings dependency
def get_settings_dep() -> Settings:
    """Get application settings."""
    return get_settings()


# Cache dependency
def get_cache() -> RedisCache:
    """Get Redis cache instance."""
    return RedisCache()


# Storage dependencies
def get_local_storage() -> LocalFileStorage:
    """Get local file storage instance."""
    return LocalFileStorage()


def get_image_fetcher() -> ImageFetcher:
    """Get image fetcher instance."""
    return ImageFetcher()


# Loader dependencies
def get_house_loader(
    cache: Annotated[RedisCache, Depends(get_cache)]
) -> BaseHouseLoader:
    """Get house checklist loader."""
    return BaseHouseLoader(cache)


def get_rooms_loader(
    cache: Annotated[RedisCache, Depends(get_cache)]
) -> BaseRoomsLoader:
    """Get rooms checklist loader."""
    return BaseRoomsLoader(cache)


def get_products_loader(
    cache: Annotated[RedisCache, Depends(get_cache)]
) -> BaseProductsLoader:
    """Get products checklist loader."""
    return BaseProductsLoader(cache)


def get_custom_user_loader(
    cache: Annotated[RedisCache, Depends(get_cache)]
) -> CustomUserLoader:
    """Get custom user checklist loader."""
    return CustomUserLoader(cache)


# Services dependencies
def get_cost_manager() -> CostManager:
    """Get cost manager instance."""
    return CostManager()


def get_agent_tracker() -> AgentExecutionTracker:
    """Get agent execution tracker instance."""
    return AgentExecutionTracker()


def get_agents_service(
    settings: Annotated[Settings, Depends(get_settings_dep)]
) -> AgentsService:
    """Get agents service instance."""
    return AgentsService(settings)


# Type aliases for dependency injection
SettingsDep = Annotated[Settings, Depends(get_settings_dep)]
CacheDep = Annotated[RedisCache, Depends(get_cache)]
LocalStorageDep = Annotated[LocalFileStorage, Depends(get_local_storage)]
ImageFetcherDep = Annotated[ImageFetcher, Depends(get_image_fetcher)]
HouseLoaderDep = Annotated[BaseHouseLoader, Depends(get_house_loader)]
RoomsLoaderDep = Annotated[BaseRoomsLoader, Depends(get_rooms_loader)]
ProductsLoaderDep = Annotated[BaseProductsLoader, Depends(get_products_loader)]
CustomUserLoaderDep = Annotated[CustomUserLoader, Depends(get_custom_user_loader)]
CostManagerDep = Annotated[CostManager, Depends(get_cost_manager)]
AgentTrackerDep = Annotated[AgentExecutionTracker, Depends(get_agent_tracker)]
AgentsServiceDep = Annotated[AgentsService, Depends(get_agents_service)]