"""
System capability discovery module.
Scans the system and discovers available tools/commands.
"""
import shutil
import os
import platform
from typing import List, Dict
from registry import EndpointMetadata, EndpointRegistry


class SystemDiscovery:
    """Discovers system capabilities and registers endpoints."""
    
    def __init__(self, registry: EndpointRegistry):
        self.registry = registry
    
    def discover_all(self) -> None:
        """Run all discovery methods."""
        # Always include sample modules first
        self.discover_sample_modules()
        self.discover_common_tools()
        self.discover_python_tools()
        self.discover_node_tools()
        self.discover_git_tools()
        self.discover_system_info()
    
    def discover_sample_modules(self) -> None:
        """Discover sample/demo modules that are always available."""
        sample_modules = [
            {
                'id': 'sample_text_uppercase',
                'name': 'Text to Uppercase',
                'description': 'Converts text to uppercase',
                'category': 'Text Processing',
                'parameters': {'input': 'text'}
            },
            {
                'id': 'sample_text_lowercase',
                'name': 'Text to Lowercase',
                'description': 'Converts text to lowercase',
                'category': 'Text Processing',
                'parameters': {'input': 'text'}
            },
            {
                'id': 'sample_text_reverse',
                'name': 'Reverse Text',
                'description': 'Reverses the order of characters in text',
                'category': 'Text Processing',
                'parameters': {'input': 'text'}
            },
            {
                'id': 'sample_text_word_count',
                'name': 'Count Words',
                'description': 'Counts the number of words in text',
                'category': 'Text Processing',
                'parameters': {'input': 'text'}
            },
            {
                'id': 'sample_math_add',
                'name': 'Add Numbers',
                'description': 'Adds two numbers together',
                'category': 'Math Operations',
                'parameters': {'a': 0, 'b': 0}
            },
            {
                'id': 'sample_math_multiply',
                'name': 'Multiply Numbers',
                'description': 'Multiplies two numbers together',
                'category': 'Math Operations',
                'parameters': {'a': 1, 'b': 1}
            },
            {
                'id': 'sample_math_power',
                'name': 'Power',
                'description': 'Raises a number to a power',
                'category': 'Math Operations',
                'parameters': {'base': 2, 'exponent': 2}
            },
            {
                'id': 'sample_data_json_parse',
                'name': 'Parse JSON',
                'description': 'Parses a JSON string into an object',
                'category': 'Data Processing',
                'parameters': {'json_string': '{}'}
            },
            {
                'id': 'sample_data_json_stringify',
                'name': 'Stringify JSON',
                'description': 'Converts an object to a JSON string',
                'category': 'Data Processing',
                'parameters': {'data': {}}
            },
            {
                'id': 'sample_util_delay',
                'name': 'Delay',
                'description': 'Waits for a specified number of seconds',
                'category': 'Utilities',
                'parameters': {'seconds': 1}
            },
            {
                'id': 'sample_util_timestamp',
                'name': 'Get Timestamp',
                'description': 'Gets the current timestamp',
                'category': 'Utilities',
                'parameters': {}
            },
            {
                'id': 'sample_util_random',
                'name': 'Random Number',
                'description': 'Generates a random number between min and max',
                'category': 'Utilities',
                'parameters': {'min': 0, 'max': 100}
            },
            {
                'id': 'sample_string_concat',
                'name': 'Concatenate Strings',
                'description': 'Combines two strings together',
                'category': 'Text Processing',
                'parameters': {'str1': '', 'str2': ''}
            },
            {
                'id': 'sample_string_replace',
                'name': 'Replace Text',
                'description': 'Replaces occurrences of text in a string',
                'category': 'Text Processing',
                'parameters': {'text': '', 'old': '', 'new': ''}
            }
        ]
        
        for module in sample_modules:
            endpoint = EndpointMetadata(
                id=module['id'],
                name=module['name'],
                description=module['description'],
                category=module['category'],
                parameters=module['parameters']
            )
            self.registry.register(endpoint)
    
    def discover_common_tools(self) -> None:
        """Discover common command-line tools."""
        common_tools = {
            'python': {'name': 'Python', 'description': 'Python interpreter'},
            'node': {'name': 'Node.js', 'description': 'Node.js runtime'},
            'npm': {'name': 'NPM', 'description': 'Node Package Manager'},
            'git': {'name': 'Git', 'description': 'Git version control'},
            'docker': {'name': 'Docker', 'description': 'Docker container platform'},
            'kubectl': {'name': 'Kubernetes', 'description': 'Kubernetes CLI'},
        }
        
        for tool, info in common_tools.items():
            if shutil.which(tool):
                endpoint = EndpointMetadata(
                    id=f"tool_{tool}",
                    name=info['name'],
                    description=info['description'],
                    category="Tools",
                    parameters={
                        'command': tool,
                        'version': self._get_version(tool)
                    }
                )
                self.registry.register(endpoint)
    
    def discover_python_tools(self) -> None:
        """Discover Python-specific tools."""
        python_tools = {
            'pip': {'name': 'pip', 'description': 'Python package installer'},
            'pipenv': {'name': 'Pipenv', 'description': 'Python dependency management'},
            'poetry': {'name': 'Poetry', 'description': 'Python dependency and package management'},
            'black': {'name': 'Black', 'description': 'Python code formatter'},
            'flake8': {'name': 'Flake8', 'description': 'Python linter'},
            'pytest': {'name': 'pytest', 'description': 'Python testing framework'},
        }
        
        for tool, info in python_tools.items():
            if shutil.which(tool):
                endpoint = EndpointMetadata(
                    id=f"python_{tool}",
                    name=info['name'],
                    description=info['description'],
                    category="Python Tools",
                    parameters={'command': tool}
                )
                self.registry.register(endpoint)
    
    def discover_node_tools(self) -> None:
        """Discover Node.js-specific tools."""
        node_tools = {
            'yarn': {'name': 'Yarn', 'description': 'Yarn package manager'},
            'pnpm': {'name': 'pnpm', 'description': 'pnpm package manager'},
            'npx': {'name': 'npx', 'description': 'Execute npm packages'},
            'tsc': {'name': 'TypeScript Compiler', 'description': 'TypeScript compiler'},
        }
        
        for tool, info in node_tools.items():
            if shutil.which(tool):
                endpoint = EndpointMetadata(
                    id=f"node_{tool}",
                    name=info['name'],
                    description=info['description'],
                    category="Node.js Tools",
                    parameters={'command': tool}
                )
                self.registry.register(endpoint)
    
    def discover_git_tools(self) -> None:
        """Discover Git-related capabilities."""
        if shutil.which('git'):
            # Check if we're in a git repository
            try:
                import subprocess
                result = subprocess.run(
                    ['git', 'rev-parse', '--is-inside-work-tree'],
                    capture_output=True,
                    text=True,
                    timeout=2
                )
                if result.returncode == 0:
                    endpoint = EndpointMetadata(
                        id="git_repo",
                        name="Git Repository",
                        description="Current directory is a Git repository",
                        category="Git",
                        parameters={'is_repo': 'true'}
                    )
                    self.registry.register(endpoint)
            except Exception:
                pass
    
    def discover_system_info(self) -> None:
        """Discover system information."""
        system_info = EndpointMetadata(
            id="system_info",
            name="System Information",
            description=f"System: {platform.system()} {platform.release()}",
            category="System",
            parameters={
                'system': platform.system(),
                'release': platform.release(),
                'version': platform.version(),
                'machine': platform.machine(),
                'processor': platform.processor()
            }
        )
        self.registry.register(system_info)
    
    def _get_version(self, command: str) -> str:
        """Get version of a command if available."""
        try:
            import subprocess
            result = subprocess.run(
                [command, '--version'],
                capture_output=True,
                text=True,
                timeout=2
            )
            if result.returncode == 0:
                return result.stdout.strip().split('\n')[0]
        except Exception:
            pass
        return "unknown"
