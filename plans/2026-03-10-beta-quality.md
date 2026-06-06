# ezlibby Beta Quality Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Elevate ezlibby from alpha to professional beta quality — clean code, tests, docs, and project infrastructure.

**Architecture:** Deduplicate shared logic between CLI display and GUI into reusable modules. Add pytest-based test suite covering parsing, caching, display, and URL detection. Add README, git repo, and linting via ruff.

**Tech Stack:** Python 3.8+, pytest, ruff, rich, tkinter

---

### Task 1: Initialize Git Repository

**Files:**
- Create: `.gitignore`

**Step 1: Create .gitignore**

```
__pycache__/
*.py[cod]
*.egg-info/
dist/
build/
.eggs/
*.egg
.ruff_cache/
.pytest_cache/
.cache/
*.swp
*.swo
.DS_Store
```

**Step 2: Initialize git and make initial commit**

Run: `git init`
Run: `git add .`
Run: `git commit -m "chore: initial commit of ezlibby v0.1.0"`

---

### Task 2: Add Dev Dependencies and Tool Config

**Files:**
- Modify: `pyproject.toml`

**Step 1: Update pyproject.toml with dev deps, ruff config, and pytest config**

Add to `pyproject.toml`:

```toml
[project.optional-dependencies]
dev = [
    "pytest>=7.0",
    "ruff>=0.4.0",
]

[tool.ruff]
target-version = "py38"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "W", "I", "UP", "B", "SIM"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

**Step 2: Add --version flag to CLI**

In `ezlibby/main.py`, add to `parse_args()` after the parser is created:

```python
parser.add_argument(
    "--version", "-V",
    action="version",
    version=f"%(prog)s {__version__}",
)
```

And add the import at the top of `main.py`:

```python
from . import __version__
```

**Step 3: Install dev deps and verify**

Run: `pip install -e ".[dev]"`
Run: `ruff check ezlibby/`
Run: `pytest --co` (just collect, should find 0 tests)

**Step 4: Commit**

```
git add pyproject.toml ezlibby/main.py
git commit -m "chore: add dev dependencies, ruff config, pytest config, --version flag"
```

---

### Task 3: Deduplicate Shared Logic

The `format_availability` function exists in both `display.py` (Rich markup version) and `gui.py` (plain text + color tuple version). The `sort_key` function is duplicated identically. Extract `sort_key` into a shared location and remove the GUI's duplicate.

**Files:**
- Modify: `ezlibby/display.py` — no changes needed, `sort_key` stays here as the canonical location
- Modify: `ezlibby/gui.py:196-206` — remove duplicate `sort_key`, import from display

**Step 1: Write a test for sort_key**

Create `tests/__init__.py` (empty) and `tests/test_display.py`:

```python
"""Tests for display module."""

from ezlibby.display import sort_key
from ezlibby.overdrive import AvailabilityStatus, FormatAvailability, LibbyResult


def _make_result(ebook_status=None, audiobook_status=None, ebook_wait=None, audiobook_wait=None):
    """Helper to create a LibbyResult with given statuses."""
    ebook = FormatAvailability(status=ebook_status, wait_days=ebook_wait) if ebook_status else None
    audiobook = FormatAvailability(status=audiobook_status, wait_days=audiobook_wait) if audiobook_status else None
    return LibbyResult(title="Test", author="Author", ebook=ebook, audiobook=audiobook)


def test_sort_key_available_first():
    available = _make_result(ebook_status=AvailabilityStatus.AVAILABLE)
    waitlist = _make_result(ebook_status=AvailabilityStatus.WAITLIST)
    not_found = _make_result(ebook_status=AvailabilityStatus.NOT_FOUND)

    assert sort_key(available) < sort_key(waitlist)
    assert sort_key(waitlist) < sort_key(not_found)


def test_sort_key_both_available_best():
    both = _make_result(
        ebook_status=AvailabilityStatus.AVAILABLE,
        audiobook_status=AvailabilityStatus.AVAILABLE,
    )
    one = _make_result(ebook_status=AvailabilityStatus.AVAILABLE)

    assert sort_key(both) < sort_key(one)
```

**Step 2: Run test to verify it passes (sort_key already exists)**

Run: `pytest tests/test_display.py -v`
Expected: PASS

**Step 3: Remove duplicate sort_key from gui.py**

In `ezlibby/gui.py`, add import:
```python
from .display import sort_key
```

Remove the local `sort_key` function definition (lines 196-206 inside `_populate_table`). Replace:
```python
sorted_results = sorted(self.results, key=sort_key)
```

**Step 4: Also remove unused `time` import from overdrive.py and the unused `search_with_delay` method (lines 178-183)**

**Step 5: Fix duplicate print in main.py lines 247-250** — both branches print the same message, collapse to one:

```python
if self.pending_books:
    self.console.print(f"[dim]Fetching {len(self.pending_books)} books from Libby...[/dim]")
```

**Step 6: Run tests and ruff**

Run: `ruff check ezlibby/`
Run: `pytest tests/ -v`

**Step 7: Commit**

```
git commit -m "refactor: deduplicate sort_key, remove unused code, fix duplicate print"
```

---

### Task 4: Cross-Platform Font Handling

**Files:**
- Modify: `ezlibby/gui.py`

**Step 1: Replace hardcoded SF Pro Display with platform-aware font**

At the top of `gui.py`, add a helper:

```python
import sys

def _get_font():
    """Get the best available system font for the current platform."""
    if sys.platform == "darwin":
        return "SF Pro Display"
    elif sys.platform == "win32":
        return "Segoe UI"
    else:
        return "sans-serif"

FONT_FAMILY = _get_font()
```

Then replace all `"SF Pro Display"` references with `FONT_FAMILY`.

**Step 2: Verify no hardcoded font strings remain**

Run: `grep -n "SF Pro" ezlibby/gui.py` — should return nothing.

**Step 3: Commit**

```
git commit -m "fix: use platform-appropriate fonts in GUI"
```

---

### Task 5: Cache Expiration and --clear-cache

**Files:**
- Modify: `ezlibby/cache.py`
- Modify: `ezlibby/main.py`
- Create: `tests/test_cache.py`

**Step 1: Write failing tests for cache expiration**

```python
"""Tests for cache module."""

import json
from datetime import datetime, timedelta
from pathlib import Path

from ezlibby.cache import AvailabilityCache, CachedResult, make_cache_key
from ezlibby.overdrive import AvailabilityStatus, FormatAvailability, LibbyResult


def _make_result(title="Test Book", author="Test Author"):
    return LibbyResult(
        title=title,
        author=author,
        ebook=FormatAvailability(status=AvailabilityStatus.AVAILABLE),
        audiobook=FormatAvailability(status=AvailabilityStatus.NOT_FOUND),
    )


def test_make_cache_key_case_insensitive():
    assert make_cache_key("Hello", "World") == make_cache_key("hello", "world")


def test_make_cache_key_strips_whitespace():
    assert make_cache_key("  Hello  ", "  World  ") == make_cache_key("Hello", "World")


def test_cache_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr("ezlibby.cache.get_cache_dir", lambda: tmp_path)
    cache = AvailabilityCache("testlib")
    result = _make_result()
    cache.set(result)

    cached = cache.get("Test Book", "Test Author")
    assert cached is not None
    assert cached.title == "Test Book"
    assert cached.ebook_status == "available"


def test_cache_expired_entry_ignored(tmp_path, monkeypatch):
    monkeypatch.setattr("ezlibby.cache.get_cache_dir", lambda: tmp_path)
    cache = AvailabilityCache("testlib")
    result = _make_result()
    cache.set(result)

    # Manually backdate the entry
    cache_file = tmp_path / "testlib.json"
    data = json.loads(cache_file.read_text())
    key = make_cache_key("Test Book", "Test Author")
    old_time = (datetime.now() - timedelta(hours=25)).isoformat()
    data[key]["updated_at"] = old_time
    cache_file.write_text(json.dumps(data))

    # Reload cache
    cache2 = AvailabilityCache("testlib")
    cached = cache2.get("Test Book", "Test Author", max_age_hours=24)
    assert cached is None


def test_cache_fresh_entry_returned(tmp_path, monkeypatch):
    monkeypatch.setattr("ezlibby.cache.get_cache_dir", lambda: tmp_path)
    cache = AvailabilityCache("testlib")
    result = _make_result()
    cache.set(result)

    cached = cache.get("Test Book", "Test Author", max_age_hours=24)
    assert cached is not None


def test_cache_clear(tmp_path, monkeypatch):
    monkeypatch.setattr("ezlibby.cache.get_cache_dir", lambda: tmp_path)
    cache = AvailabilityCache("testlib")
    cache.set(_make_result())
    assert cache.get("Test Book", "Test Author") is not None

    cache.clear()
    assert cache.get("Test Book", "Test Author") is None


def test_cached_result_age_str():
    now = datetime.now()
    result = CachedResult(
        title="Test", author="Author",
        ebook_status="available", ebook_wait_days=None, ebook_holds=None,
        audiobook_status="not_found", audiobook_wait_days=None, audiobook_holds=None,
        updated_at=now.isoformat(),
    )
    assert result.age_str() == "just now"
```

**Step 2: Run tests — should fail on `max_age_hours` and `clear` (not implemented yet)**

Run: `pytest tests/test_cache.py -v`

**Step 3: Implement cache expiration and clear**

In `ezlibby/cache.py`, modify the `get` method to accept `max_age_hours`:

```python
def get(self, title: str, author: str, max_age_hours: Optional[int] = None) -> Optional[CachedResult]:
    """Get a cached result by title and author.

    Args:
        max_age_hours: If set, ignore entries older than this many hours.
    """
    key = make_cache_key(title, author)
    data = self._cache.get(key)
    if data:
        try:
            result = CachedResult(**data)
            if max_age_hours is not None:
                updated = datetime.fromisoformat(result.updated_at)
                age_hours = (datetime.now() - updated).total_seconds() / 3600
                if age_hours > max_age_hours:
                    return None
            return result
        except (TypeError, KeyError):
            return None
    return None
```

Add a `clear` method:

```python
def clear(self) -> None:
    """Clear all cached data."""
    self._cache = {}
    self._save()
```

**Step 4: Add --clear-cache and --cache-max-age to CLI**

In `main.py` `parse_args()`:

```python
parser.add_argument(
    "--clear-cache",
    action="store_true",
    help="Clear cached data for this library and exit",
)
parser.add_argument(
    "--cache-max-age",
    type=int,
    default=24,
    help="Max age of cached results in hours (default: 24)",
)
```

In `main()`, after cache initialization, handle `--clear-cache`:

```python
if args.clear_cache:
    cache.clear()
    console.print(f"[green]Cache cleared for {args.library}[/green]")
    return 0
```

And pass `max_age_hours` through to the LiveSearcher (which passes it to `cache.get`).

**Step 5: Update LiveSearcher._load_from_cache to use max_age_hours**

Add `max_age_hours` parameter to `LiveSearcher.__init__` and use it in `_load_from_cache`:

```python
cached = self.cache.get(book.title, book.author, max_age_hours=self.max_age_hours)
```

**Step 6: Run tests**

Run: `pytest tests/test_cache.py -v`
Expected: ALL PASS

**Step 7: Commit**

```
git commit -m "feat: add cache expiration (24h default) and --clear-cache flag"
```

---

### Task 6: Tests for Goodreads Parsing and URL Detection

**Files:**
- Create: `tests/test_goodreads.py`
- Create: `tests/test_main.py`

**Step 1: Write tests for goodreads module**

```python
"""Tests for goodreads module."""

from ezlibby.goodreads import clean_isbn, clean_title


def test_clean_title_removes_series_info():
    assert clean_title("Leviathan Wakes (The Expanse, #1)") == "Leviathan Wakes"


def test_clean_title_preserves_normal_parens():
    assert clean_title("Why We Sleep") == "Why We Sleep"


def test_clean_title_preserves_non_series_parens():
    assert clean_title("Some Book (A Memoir)") == "Some Book (A Memoir)"


def test_clean_isbn_goodreads_format():
    assert clean_isbn('="0060590297"') == "0060590297"


def test_clean_isbn_empty():
    assert clean_isbn('=""') == ""


def test_clean_isbn_plain():
    assert clean_isbn("0060590297") == "0060590297"


def test_clean_isbn_whitespace():
    assert clean_isbn('  ="0060590297"  ') == "0060590297"
```

**Step 2: Write tests for URL detection and conversion**

```python
"""Tests for CLI main module."""

from ezlibby.main import convert_goodreads_url_to_rss, detect_source_type


def test_detect_source_type_url():
    assert detect_source_type("https://www.goodreads.com/review/list/123") == "url"


def test_detect_source_type_user_id():
    assert detect_source_type("12345678") == "url"


def test_detect_source_type_csv_file():
    assert detect_source_type("export.csv") == "file"


def test_detect_source_type_http():
    assert detect_source_type("http://goodreads.com/review/list/123") == "url"


def test_convert_url_to_rss_full_url():
    result = convert_goodreads_url_to_rss("https://www.goodreads.com/review/list/12345?shelf=to-read")
    assert result == "https://www.goodreads.com/review/list_rss/12345?shelf=to-read"


def test_convert_url_to_rss_user_id_only():
    result = convert_goodreads_url_to_rss("12345")
    assert result == "https://www.goodreads.com/review/list_rss/12345?shelf=to-read"


def test_convert_url_to_rss_preserves_rss_url_with_key():
    url = "https://www.goodreads.com/review/list_rss/12345?key=ABC&shelf=to-read"
    assert convert_goodreads_url_to_rss(url) == url


def test_convert_url_to_rss_invalid_url():
    import pytest
    with pytest.raises(ValueError, match="Could not extract"):
        convert_goodreads_url_to_rss("https://example.com/not-goodreads")
```

**Step 3: Run tests**

Run: `pytest tests/ -v`
Expected: ALL PASS

**Step 4: Commit**

```
git commit -m "test: add tests for goodreads parsing and URL detection"
```

---

### Task 7: Tests for Display Formatting

**Files:**
- Modify: `tests/test_display.py`

**Step 1: Add tests for format_availability and build_summary**

Append to `tests/test_display.py`:

```python
from ezlibby.display import format_availability, build_summary


def test_format_availability_available():
    avail = FormatAvailability(status=AvailabilityStatus.AVAILABLE)
    assert "Available" in format_availability(avail)


def test_format_availability_waitlist_days():
    avail = FormatAvailability(status=AvailabilityStatus.WAITLIST, wait_days=5)
    result = format_availability(avail)
    assert "5d" in result


def test_format_availability_waitlist_weeks():
    avail = FormatAvailability(status=AvailabilityStatus.WAITLIST, wait_days=14)
    result = format_availability(avail)
    assert "2w" in result


def test_format_availability_waitlist_months():
    avail = FormatAvailability(status=AvailabilityStatus.WAITLIST, wait_days=60)
    result = format_availability(avail)
    assert "2mo" in result


def test_format_availability_not_found():
    avail = FormatAvailability(status=AvailabilityStatus.NOT_FOUND)
    assert "Not found" in format_availability(avail)


def test_format_availability_none():
    assert "--" in format_availability(None)


def test_build_summary():
    results = [
        _make_result(ebook_status=AvailabilityStatus.AVAILABLE),
        _make_result(ebook_status=AvailabilityStatus.WAITLIST),
        _make_result(ebook_status=AvailabilityStatus.NOT_FOUND),
    ]
    summary = build_summary(results)
    assert "1 available" in summary
    assert "1 on waitlist" in summary
```

**Step 2: Run tests**

Run: `pytest tests/test_display.py -v`
Expected: ALL PASS

**Step 3: Commit**

```
git commit -m "test: add tests for display formatting and summary"
```

---

### Task 8: Ruff Lint Fixes

**Step 1: Run ruff and fix all issues**

Run: `ruff check ezlibby/ --fix`
Run: `ruff format ezlibby/ tests/`

**Step 2: Run tests to verify nothing broke**

Run: `pytest tests/ -v`

**Step 3: Commit**

```
git commit -m "style: apply ruff formatting and lint fixes"
```

---

### Task 9: README

**Files:**
- Create: `README.md`

**Step 1: Write README**

The README should include:
- Project name and one-line description
- What it does (match Goodreads want-to-read with Libby availability)
- Installation (`pip install .` or `pip install -e ".[dev]"`)
- Quick start usage examples (RSS URL, CSV, user ID)
- CLI flags reference table
- How to find your library's OverDrive key (go to libbyapp.com, search for library, key is in the URL)
- How to get your Goodreads RSS URL
- Screenshot placeholder or description of output
- License section (TBD)

**Step 2: Commit**

```
git commit -m "docs: add README with install and usage instructions"
```

---

### Task 10: Better Error Messages

**Files:**
- Modify: `ezlibby/overdrive.py`
- Modify: `ezlibby/main.py`

**Step 1: Add a check for invalid library keys**

In `OverDriveClient.__init__`, add a method to validate the library key on first search. If the API returns 404, raise a clear error:

```python
class LibraryNotFoundError(Exception):
    """Raised when the library key is not valid."""
    pass
```

In `_search_format`, check for 404 response and raise:

```python
if resp.status_code == 404:
    raise LibraryNotFoundError(
        f"Library '{self.library_key}' not found on OverDrive.\n\n"
        "To find your library's key:\n"
        "  1. Go to libbyapp.com\n"
        "  2. Search for your library\n"
        "  3. The key is in the URL: libbyapp.com/library/YOUR_KEY\n\n"
        "Example keys: chipublib, nypl, lapl, sfpl"
    )
```

In `main.py`, catch `LibraryNotFoundError` specifically in the main try/except.

**Step 2: Add network error context**

In `_search_format`, wrap `requests.ConnectionError` with a friendlier message.

**Step 3: Run tests**

Run: `pytest tests/ -v`

**Step 4: Commit**

```
git commit -m "feat: improve error messages for invalid library keys and network failures"
```

---

### Task 11: Final Verification

**Step 1: Run full test suite**

Run: `pytest tests/ -v`

**Step 2: Run linter**

Run: `ruff check ezlibby/ tests/`

**Step 3: Verify CLI works**

Run: `ezlibby --version`
Run: `ezlibby --help`

**Step 4: Bump version to 0.2.0-beta**

In `ezlibby/__init__.py`:
```python
__version__ = "0.2.0-beta"
```

In `pyproject.toml`:
```toml
version = "0.2.0-beta"
```

**Step 5: Final commit**

```
git commit -m "chore: bump version to 0.2.0-beta"
```

---

## Execution Notes

- Tasks 1-2 are infrastructure setup, do first sequentially
- Task 3-4 are refactoring, can be done in parallel
- Task 5 (cache) is the most complex feature task
- Tasks 6-7 are pure test additions, can be done in parallel
- Task 8 (ruff) should run after all code changes
- Task 9 (README) is independent
- Task 10 (errors) is independent
- Task 11 is final verification, must be last
