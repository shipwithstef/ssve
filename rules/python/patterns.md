---
description: Python steering — Protocol for structural interfaces, @dataclass for internal DTOs
paths:
  - "**/*.py"
  - "**/*.pyi"
scope: project
stack: python
type: steering
source: blended:ecc
source_sha: 125d5e619905d97b519a887d5bc7332dcc448a52
last_evaluated: "2026-04-13"
---

# Python Patterns

## Protocol for Structural Interfaces

Define repository and service interfaces using `typing.Protocol` — not ABC:

```python
from typing import Protocol

class Repository(Protocol):
    def find_by_id(self, id: str) -> dict | None: ...
    def save(self, entity: dict) -> dict: ...
```

Prefer Protocol over `abc.ABC` + `@abstractmethod`. Protocol uses structural subtyping — implementations don't need to inherit from the interface, which keeps dependencies explicit and testable without inheritance coupling.

## Dataclasses for Internal DTOs

Use `@dataclass` for data transfer objects that don't cross API boundaries:

```python
from dataclasses import dataclass

@dataclass
class CreateUserRequest:
    name: str
    email: str
    age: int | None = None
```

For types that cross API boundaries or require validation, prefer Pydantic `BaseModel` instead.
