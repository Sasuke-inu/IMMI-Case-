"""Structured background job state management.

This module centralises lifecycle operations around the mutable in-memory
job status dictionaries used by the web layer, while preserving legacy
compatibility with callers that still import ``_job_lock`` / ``_job_status``.
"""

from __future__ import annotations

from copy import deepcopy
import threading
from typing import Any, Callable


StateFactory = Callable[[], dict[str, Any]]


class JobManager:
    """Manage a mutable job-status mapping behind an explicit lock.

    The underlying state dict is intentionally exposed via ``state`` so older
    code can keep working during migration. New code should prefer the helper
    methods here for snapshots and common mutations.
    """

    def __init__(self, default_state_factory: StateFactory):
        self._default_state_factory = default_state_factory
        self._lock = threading.Lock()
        self._state = self._default_state_factory()

    @property
    def lock(self) -> threading.Lock:
        return self._lock

    @property
    def state(self) -> dict[str, Any]:
        return self._state

    def reset(self) -> None:
        self.replace(self._default_state_factory())

    def replace(self, new_state: dict[str, Any]) -> None:
        with self._lock:
            self._state.clear()
            self._state.update(deepcopy(new_state))

    def reserve(self, new_state: dict[str, Any]) -> bool:
        """Atomically claim the job slot if nothing is currently running."""
        with self._lock:
            if self._state.get("running"):
                return False
            self._state.clear()
            self._state.update(deepcopy(new_state))
            return True

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return deepcopy(self._state)

    def is_running(self) -> bool:
        with self._lock:
            return bool(self._state.get("running"))

    def get(self, key: str, default: Any = None) -> Any:
        with self._lock:
            return self._state.get(key, default)

    def update(self, **fields: Any) -> None:
        with self._lock:
            self._state.update(fields)

    def increment(self, key: str, amount: int = 1) -> int:
        with self._lock:
            next_value = int(self._state.get(key, 0)) + amount
            self._state[key] = next_value
            return next_value

    def append(self, key: str, value: Any) -> None:
        with self._lock:
            values = self._state.setdefault(key, [])
            if not isinstance(values, list):
                raise TypeError(f"Job state field '{key}' is not a list")
            values.append(value)

    def mutate(self, callback: Callable[[dict[str, Any]], Any]) -> Any:
        with self._lock:
            return callback(self._state)
