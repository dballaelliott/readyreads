"""Local cache for Libby availability data."""

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from .overdrive import AvailabilityStatus, FormatAvailability, LibbyResult


def get_cache_dir() -> Path:
    """Get the cache directory, creating it if needed."""
    cache_dir = Path.home() / ".cache" / "readyreads"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def get_cache_file(library_key: str) -> Path:
    """Get the cache file path for a specific library."""
    return get_cache_dir() / f"{library_key}.json"


@dataclass
class CachedResult:
    """A cached availability result with timestamp."""
    title: str
    author: str
    ebook_status: str
    ebook_wait_days: Optional[int]
    ebook_holds: Optional[int]
    audiobook_status: str
    audiobook_wait_days: Optional[int]
    audiobook_holds: Optional[int]
    updated_at: str  # ISO format timestamp
    overdrive_id: Optional[str] = None

    def to_libby_result(self) -> LibbyResult:
        """Convert cached data back to LibbyResult."""
        ebook = FormatAvailability(
            status=AvailabilityStatus(self.ebook_status),
            wait_days=self.ebook_wait_days,
            holds_count=self.ebook_holds,
        )
        audiobook = FormatAvailability(
            status=AvailabilityStatus(self.audiobook_status),
            wait_days=self.audiobook_wait_days,
            holds_count=self.audiobook_holds,
        )
        return LibbyResult(
            title=self.title,
            author=self.author,
            ebook=ebook,
            audiobook=audiobook,
            overdrive_id=self.overdrive_id,
        )

    def age_str(self) -> str:
        """Get human-readable age of the cached data."""
        updated = datetime.fromisoformat(self.updated_at)
        age = datetime.now() - updated

        if age.days > 30:
            months = age.days // 30
            return f"{months}mo ago"
        elif age.days > 0:
            return f"{age.days}d ago"
        elif age.seconds > 3600:
            hours = age.seconds // 3600
            return f"{hours}h ago"
        elif age.seconds > 60:
            mins = age.seconds // 60
            return f"{mins}m ago"
        else:
            return "just now"

    @classmethod
    def from_libby_result(cls, result: LibbyResult) -> "CachedResult":
        """Create a CachedResult from a LibbyResult."""
        return cls(
            title=result.title,
            author=result.author,
            ebook_status=result.ebook.status.value if result.ebook else "not_found",
            ebook_wait_days=result.ebook.wait_days if result.ebook else None,
            ebook_holds=result.ebook.holds_count if result.ebook else None,
            audiobook_status=result.audiobook.status.value if result.audiobook else "not_found",
            audiobook_wait_days=result.audiobook.wait_days if result.audiobook else None,
            audiobook_holds=result.audiobook.holds_count if result.audiobook else None,
            updated_at=datetime.now().isoformat(),
            overdrive_id=result.overdrive_id,
        )


def make_cache_key(title: str, author: str) -> str:
    """Create a cache key from title and author."""
    # Normalize: lowercase, strip whitespace
    key = f"{title.lower().strip()}|{author.lower().strip()}"
    return key


class AvailabilityCache:
    """Cache for book availability data."""

    def __init__(self, library_key: str):
        self.library_key = library_key
        self.cache_file = get_cache_file(library_key)
        self._cache: Dict[str, dict] = {}
        self._load()

    def _load(self) -> None:
        """Load cache from disk."""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, "r") as f:
                    self._cache = json.load(f)
            except (json.JSONDecodeError, IOError):
                self._cache = {}

    def _save(self) -> None:
        """Save cache to disk."""
        try:
            with open(self.cache_file, "w") as f:
                json.dump(self._cache, f, indent=2)
        except IOError:
            pass  # Fail silently on write errors

    def get(self, title: str, author: str) -> Optional[CachedResult]:
        """Get a cached result by title and author."""
        key = make_cache_key(title, author)
        data = self._cache.get(key)
        if data:
            try:
                return CachedResult(**data)
            except (TypeError, KeyError):
                return None
        return None

    def set(self, result: LibbyResult, search_title: Optional[str] = None, search_author: Optional[str] = None) -> None:
        """Cache a LibbyResult.

        Args:
            result: The LibbyResult to cache
            search_title: Original search title (for cache key). Uses result.title if not provided.
            search_author: Original search author (for cache key). Uses result.author if not provided.
        """
        # Use search terms for key if provided, otherwise use result
        key_title = search_title if search_title else result.title
        key_author = search_author if search_author else result.author
        key = make_cache_key(key_title, key_author)

        cached = CachedResult.from_libby_result(result)
        self._cache[key] = asdict(cached)
        self._save()
