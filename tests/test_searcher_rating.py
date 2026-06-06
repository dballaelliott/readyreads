"""The Goodreads rating must ride along onto each LibbyResult."""

from datetime import datetime

from rich.console import Console

from readyreads.cache import CachedResult
from readyreads.goodreads import Book
from readyreads.main import LiveSearcher
from readyreads.overdrive import AvailabilityStatus, FormatAvailability, LibbyResult


class FakeClient:
    """Returns a canned LibbyResult per search, no rating attached."""

    def search(self, title, author):
        return LibbyResult(
            title=title,
            author=author,
            ebook=FormatAvailability(status=AvailabilityStatus.AVAILABLE),
        )


class NoCache:
    """Cache that never hits, swallows writes."""

    def get(self, title, author):
        return None

    def set(self, result, search_title=None, search_author=None):
        pass


class HitCache:
    """Cache that always returns a stored result (without a rating)."""

    def get(self, title, author):
        return CachedResult(
            title=title,
            author=author,
            ebook_status="available",
            ebook_wait_days=None,
            ebook_holds=None,
            audiobook_status="not_found",
            audiobook_wait_days=None,
            audiobook_holds=None,
            updated_at=datetime(2024, 1, 1).isoformat(),
        )

    def set(self, result, search_title=None, search_author=None):
        pass


def _searcher(cache, use_cache=True):
    books = [Book(title="Dune", author="Frank Herbert", goodreads_rating=4.27)]
    return LiveSearcher(
        books=books,
        client=FakeClient(),
        cache=cache,
        console=Console(),
        delay=0,
        use_cache=use_cache,
    )


def test_fetched_result_carries_rating():
    searcher = _searcher(NoCache())
    searcher._load_from_cache()
    searcher._fetch_worker()

    result = next(iter(searcher.results.values()))
    assert result.goodreads_rating == 4.27


def test_cached_result_carries_rating():
    searcher = _searcher(HitCache())
    searcher._load_from_cache()

    result = next(iter(searcher.results.values()))
    assert result.goodreads_rating == 4.27
