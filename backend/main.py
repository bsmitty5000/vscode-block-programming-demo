"""
FastAPI application with dynamic endpoint registration.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import uvicorn

from registry import EndpointRegistry, EndpointMetadata
from discovery import SystemDiscovery


app = FastAPI(title="VS Code Extension Backend", version="1.0.0")

# Enable CORS for VS Code extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize registry and discovery
registry = EndpointRegistry()
discovery = SystemDiscovery(registry)

# Run discovery on startup
@app.on_event("startup")
async def startup_event():
    """Run discovery when the server starts."""
    discovery.discover_all()


# Pydantic models for API requests/responses
class EndpointResponse(BaseModel):
    """Response model for endpoint metadata."""
    id: str
    name: str
    description: str
    category: str
    parameters: Dict[str, Any]
    discovered_at: str

    @classmethod
    def from_metadata(cls, metadata: EndpointMetadata):
        """Create response from EndpointMetadata."""
        return cls(
            id=metadata.id,
            name=metadata.name,
            description=metadata.description,
            category=metadata.category,
            parameters=metadata.parameters,
            discovered_at=metadata.discovered_at.isoformat()
        )


class ExecuteRequest(BaseModel):
    """Request model for executing an endpoint."""
    parameters: Optional[Dict[str, Any]] = None


class ExecuteResponse(BaseModel):
    """Response model for execution result."""
    success: bool
    message: str
    output: Optional[str] = None


# API Endpoints
@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "endpoints_registered": registry.count()}


@app.get("/api/discover", response_model=List[EndpointResponse])
async def discover_endpoints():
    """Get all discovered endpoints."""
    endpoints = registry.get_all()
    return [EndpointResponse.from_metadata(ep) for ep in endpoints]


@app.post("/api/execute/{endpoint_id}", response_model=ExecuteResponse)
async def execute_endpoint(endpoint_id: str, request: ExecuteRequest):
    """Execute a discovered endpoint."""
    endpoint = registry.get(endpoint_id)
    
    if not endpoint:
        raise HTTPException(status_code=404, detail=f"Endpoint '{endpoint_id}' not found")
    
    try:
        # Execute based on endpoint type
        if endpoint_id.startswith("tool_") or endpoint_id.startswith("python_") or endpoint_id.startswith("node_"):
            # Execute command-line tool
            command = endpoint.parameters.get('command', endpoint_id)
            import subprocess
            result = subprocess.run(
                [command, '--version'] if command else [endpoint_id],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                return ExecuteResponse(
                    success=True,
                    message=f"Successfully executed {endpoint.name}",
                    output=result.stdout
                )
            else:
                return ExecuteResponse(
                    success=False,
                    message=f"Execution failed: {result.stderr}",
                    output=result.stderr
                )
        
        elif endpoint_id == "system_info":
            # Return system information
            import platform
            info = {
                'system': platform.system(),
                'release': platform.release(),
                'version': platform.version(),
                'machine': platform.machine(),
            }
            return ExecuteResponse(
                success=True,
                message="System information retrieved",
                output=str(info)
            )
        
        elif endpoint_id == "git_repo":
            # Return git repository info
            import subprocess
            try:
                result = subprocess.run(
                    ['git', 'status', '--short'],
                    capture_output=True,
                    text=True,
                    timeout=2
                )
                return ExecuteResponse(
                    success=True,
                    message="Git repository status",
                    output=result.stdout if result.returncode == 0 else "No changes"
                )
            except Exception as e:
                return ExecuteResponse(
                    success=False,
                    message=f"Error getting git status: {str(e)}"
                )
        
        elif endpoint_id.startswith("sample_"):
            # Handle sample modules
            params = request.parameters or {}
            
            if endpoint_id == "sample_text_uppercase":
                text = params.get('input', '')
                result = text.upper()
                return ExecuteResponse(
                    success=True,
                    message="Text converted to uppercase",
                    output=result
                )
            
            elif endpoint_id == "sample_text_lowercase":
                text = params.get('input', '')
                result = text.lower()
                return ExecuteResponse(
                    success=True,
                    message="Text converted to lowercase",
                    output=result
                )
            
            elif endpoint_id == "sample_text_reverse":
                text = params.get('input', '')
                result = text[::-1]
                return ExecuteResponse(
                    success=True,
                    message="Text reversed",
                    output=result
                )
            
            elif endpoint_id == "sample_text_word_count":
                text = params.get('input', '')
                words = text.split()
                count = len(words)
                return ExecuteResponse(
                    success=True,
                    message="Word count calculated",
                    output=str(count)
                )
            
            elif endpoint_id == "sample_math_add":
                a = float(params.get('a', 0))
                b = float(params.get('b', 0))
                result = a + b
                return ExecuteResponse(
                    success=True,
                    message="Numbers added",
                    output=str(result)
                )
            
            elif endpoint_id == "sample_math_multiply":
                a = float(params.get('a', 1))
                b = float(params.get('b', 1))
                result = a * b
                return ExecuteResponse(
                    success=True,
                    message="Numbers multiplied",
                    output=str(result)
                )
            
            elif endpoint_id == "sample_math_power":
                base = float(params.get('base', 2))
                exponent = float(params.get('exponent', 2))
                result = base ** exponent
                return ExecuteResponse(
                    success=True,
                    message="Power calculated",
                    output=str(result)
                )
            
            elif endpoint_id == "sample_data_json_parse":
                import json
                json_string = params.get('json_string', '{}')
                try:
                    parsed = json.loads(json_string)
                    return ExecuteResponse(
                        success=True,
                        message="JSON parsed successfully",
                        output=str(parsed)
                    )
                except json.JSONDecodeError as e:
                    return ExecuteResponse(
                        success=False,
                        message=f"JSON parse error: {str(e)}"
                    )
            
            elif endpoint_id == "sample_data_json_stringify":
                import json
                data = params.get('data', {})
                try:
                    result = json.dumps(data, indent=2)
                    return ExecuteResponse(
                        success=True,
                        message="Data stringified to JSON",
                        output=result
                    )
                except Exception as e:
                    return ExecuteResponse(
                        success=False,
                        message=f"JSON stringify error: {str(e)}"
                    )
            
            elif endpoint_id == "sample_util_delay":
                import asyncio
                seconds = float(params.get('seconds', 1))
                await asyncio.sleep(seconds)
                return ExecuteResponse(
                    success=True,
                    message=f"Delayed for {seconds} seconds",
                    output=f"Delay completed"
                )
            
            elif endpoint_id == "sample_util_timestamp":
                from datetime import datetime
                timestamp = datetime.now().isoformat()
                return ExecuteResponse(
                    success=True,
                    message="Timestamp retrieved",
                    output=timestamp
                )
            
            elif endpoint_id == "sample_util_random":
                import random
                min_val = float(params.get('min', 0))
                max_val = float(params.get('max', 100))
                result = random.uniform(min_val, max_val)
                return ExecuteResponse(
                    success=True,
                    message="Random number generated",
                    output=str(result)
                )
            
            elif endpoint_id == "sample_string_concat":
                str1 = str(params.get('str1', ''))
                str2 = str(params.get('str2', ''))
                result = str1 + str2
                return ExecuteResponse(
                    success=True,
                    message="Strings concatenated",
                    output=result
                )
            
            elif endpoint_id == "sample_string_replace":
                text = str(params.get('text', ''))
                old_str = str(params.get('old', ''))
                new_str = str(params.get('new', ''))
                result = text.replace(old_str, new_str)
                return ExecuteResponse(
                    success=True,
                    message="Text replaced",
                    output=result
                )
            
            else:
                return ExecuteResponse(
                    success=False,
                    message=f"Unknown sample module: {endpoint_id}"
                )
        
        else:
            return ExecuteResponse(
                success=True,
                message=f"Endpoint {endpoint.name} executed",
                output=f"Endpoint ID: {endpoint_id}"
            )
    
    except Exception as e:
        return ExecuteResponse(
            success=False,
            message=f"Error executing endpoint: {str(e)}"
        )


@app.post("/api/refresh")
async def refresh_discovery():
    """Refresh the discovery and re-scan system."""
    registry.clear()
    discovery.discover_all()
    return {
        "status": "refreshed",
        "endpoints_registered": registry.count()
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
