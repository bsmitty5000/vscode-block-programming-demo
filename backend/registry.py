"""
Endpoint registry for managing dynamically discovered endpoints.
"""
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class EndpointMetadata:
    """Metadata for a discovered endpoint."""
    id: str
    name: str
    description: str
    category: str
    parameters: Dict[str, str] = field(default_factory=dict)
    discovered_at: datetime = field(default_factory=datetime.now)


class EndpointRegistry:
    """Registry to manage discovered endpoints."""
    
    def __init__(self):
        self._endpoints: Dict[str, EndpointMetadata] = {}
    
    def register(self, endpoint: EndpointMetadata) -> None:
        """Register a new endpoint."""
        self._endpoints[endpoint.id] = endpoint
    
    def unregister(self, endpoint_id: str) -> None:
        """Unregister an endpoint."""
        if endpoint_id in self._endpoints:
            del self._endpoints[endpoint_id]
    
    def get(self, endpoint_id: str) -> Optional[EndpointMetadata]:
        """Get an endpoint by ID."""
        return self._endpoints.get(endpoint_id)
    
    def get_all(self) -> List[EndpointMetadata]:
        """Get all registered endpoints."""
        return list(self._endpoints.values())
    
    def get_by_category(self, category: str) -> List[EndpointMetadata]:
        """Get all endpoints in a specific category."""
        return [ep for ep in self._endpoints.values() if ep.category == category]
    
    def clear(self) -> None:
        """Clear all registered endpoints."""
        self._endpoints.clear()
    
    def count(self) -> int:
        """Get the number of registered endpoints."""
        return len(self._endpoints)
