"""OverDrive/Libby search functionality."""

import time
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional

import requests


class AvailabilityStatus(Enum):
    """Book availability status on Libby."""
    AVAILABLE = "available"
    WAITLIST = "waitlist"
    NOT_FOUND = "not_found"


@dataclass
class FormatAvailability:
    """Availability info for a specific format."""
    status: AvailabilityStatus
    wait_days: Optional[int] = None
    copies_available: Optional[int] = None
    copies_owned: Optional[int] = None
    holds_count: Optional[int] = None


@dataclass
class LibbyResult:
    """Search result from Libby/OverDrive."""
    title: str
    author: str
    ebook: Optional[FormatAvailability] = None
    audiobook: Optional[FormatAvailability] = None
    overdrive_id: Optional[str] = None


class OverDriveClient:
    """Client for searching OverDrive library collections."""

    THUNDER_API = "https://thunder.api.overdrive.com/v2"

    def __init__(self, library_key: str = "chipublib"):
        """Initialize client for a specific library.

        Args:
            library_key: The library's OverDrive identifier (e.g., 'chipublib')
        """
        self.library_key = library_key
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "application/json",
        })

    def _search_format(self, query: str, format_filter: str) -> List[Dict[str, Any]]:
        """Search for media of a specific format type."""
        url = f"{self.THUNDER_API}/libraries/{self.library_key}/media"
        params = {
            "query": query,
            "perPage": 5,
            "page": 1,
        }
        if format_filter:
            params["format"] = format_filter

        try:
            resp = self.session.get(url, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            return data.get("items", [])
        except requests.RequestException:
            return []

    def _get_availability(self, item_id: str) -> Optional[Dict[str, Any]]:
        """Get availability data for a specific item."""
        url = f"{self.THUNDER_API}/libraries/{self.library_key}/media/{item_id}/availability"
        try:
            resp = self.session.get(url, timeout=30)
            if resp.status_code == 200:
                return resp.json()
        except requests.RequestException:
            pass
        return None

    def _match_item(self, items: List[Dict], title: str, author: str) -> Optional[Dict]:
        """Find the best matching item from search results."""
        if not items:
            return None

        title_lower = title.lower()
        author_lower = author.lower()

        for item in items:
            item_title = item.get("title", "").lower()
            item_author = item.get("firstCreatorName", "").lower()

            # Check for reasonable title match
            if title_lower in item_title or item_title in title_lower:
                # Check author matches (handle empty author gracefully)
                author_parts = author_lower.split()
                item_author_parts = item_author.split()
                if author_parts and item_author_parts:
                    if author_parts[0] in item_author or item_author_parts[0] in author_lower:
                        return item

        # Fall back to first result
        return items[0] if items else None

    def _parse_availability(self, avail_data: Optional[Dict]) -> FormatAvailability:
        """Parse availability data into FormatAvailability."""
        if not avail_data:
            return FormatAvailability(status=AvailabilityStatus.NOT_FOUND)

        is_available = avail_data.get("isAvailable", False)
        copies_available = avail_data.get("availableCopies", 0)
        copies_owned = avail_data.get("ownedCopies", 0)
        holds_count = avail_data.get("holdsCount", 0)
        wait_days = avail_data.get("estimatedWaitDays")

        if is_available and copies_available > 0:
            return FormatAvailability(
                status=AvailabilityStatus.AVAILABLE,
                copies_available=copies_available,
                copies_owned=copies_owned,
            )
        elif copies_owned > 0:
            return FormatAvailability(
                status=AvailabilityStatus.WAITLIST,
                wait_days=wait_days,
                holds_count=holds_count,
                copies_owned=copies_owned,
            )
        else:
            return FormatAvailability(status=AvailabilityStatus.NOT_FOUND)

    def search(self, title: str, author: str) -> LibbyResult:
        """Search for a book by title and author.

        Returns availability information for ebook and audiobook formats.
        """
        query = f"{title} {author}"

        # Search for ebooks
        ebook_formats = "ebook-overdrive,ebook-epub-adobe,ebook-epub-open,ebook-pdf-adobe,ebook-pdf-open,ebook-kindle"
        ebook_items = self._search_format(query, ebook_formats)
        ebook_match = self._match_item(ebook_items, title, author)

        ebook_avail = FormatAvailability(status=AvailabilityStatus.NOT_FOUND)
        if ebook_match:
            avail_data = self._get_availability(ebook_match.get("id"))
            ebook_avail = self._parse_availability(avail_data)

        # Search for audiobooks
        audiobook_formats = "audiobook-overdrive,audiobook-mp3"
        audiobook_items = self._search_format(query, audiobook_formats)
        audiobook_match = self._match_item(audiobook_items, title, author)

        audiobook_avail = FormatAvailability(status=AvailabilityStatus.NOT_FOUND)
        if audiobook_match:
            avail_data = self._get_availability(audiobook_match.get("id"))
            audiobook_avail = self._parse_availability(avail_data)

        # Determine result title/author from best match
        best_match = ebook_match or audiobook_match
        result_title = best_match.get("title", title) if best_match else title
        result_author = best_match.get("firstCreatorName", author) if best_match else author
        result_id = best_match.get("id") if best_match else None

        return LibbyResult(
            title=result_title,
            author=result_author,
            ebook=ebook_avail,
            audiobook=audiobook_avail,
            overdrive_id=result_id,
        )

    def search_with_delay(self, title: str, author: str, delay: float = 0.5) -> LibbyResult:
        """Search with rate limiting delay."""
        result = self.search(title, author)
        time.sleep(delay)
        return result
