"""CLI interface for readyreads."""

import argparse
import os
import re
import sys
import threading
import time
from typing import Dict, List, Optional

from . import __version__

from rich.console import Console, Group
from rich.live import Live
from rich.panel import Panel
from rich.text import Text

from .cache import AvailabilityCache
from .display import build_summary, build_table
from .goodreads import Book, fetch_from_rss, load_from_csv
from .overdrive import AvailabilityStatus, FormatAvailability, LibbyResult, OverDriveClient


def convert_goodreads_url_to_rss(url: str) -> str:
    """Convert a Goodreads shelf URL to an RSS feed URL.

    Note: If the URL doesn't include a 'key' parameter, the RSS feed may fail
    with 401 Unauthorized. Users should get their RSS URL directly from Goodreads.
    """
    # Already an RSS URL with key - use as-is
    if "list_rss" in url and "key=" in url:
        return url

    # RSS URL without key - warn but try anyway
    if "list_rss" in url:
        return url

    match = re.search(r'/review/list/(\d+)', url)
    if not match:
        if url.isdigit():
            user_id = url
        else:
            raise ValueError(f"Could not extract Goodreads user ID from: {url}")
    else:
        user_id = match.group(1)

    shelf_match = re.search(r'[?&]shelf=([^&]+)', url)
    shelf = shelf_match.group(1) if shelf_match else "to-read"

    return f"https://www.goodreads.com/review/list_rss/{user_id}?shelf={shelf}"


def detect_source_type(source: str) -> str:
    """Detect if source is a URL or file path."""
    if source.startswith(('http://', 'https://', 'www.')):
        return 'url'
    if 'goodreads.com' in source:
        return 'url'
    if os.path.exists(source):
        return 'file'
    if source.endswith('.csv'):
        return 'file'
    if source.isdigit():
        return 'url'
    return 'file'


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        prog="readyreads",
        description="Match your Goodreads want-to-read list with your library's Libby collection",
        epilog="""
Examples:
  readyreads https://www.goodreads.com/review/list/12345678?shelf=to-read
  readyreads ~/Downloads/goodreads_library_export.csv
  readyreads 12345678  # Just the user ID works too
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--version", "-V",
        action="version",
        version=f"%(prog)s {__version__}",
    )

    parser.add_argument(
        "source",
        help="Goodreads URL or CSV file path (auto-detected)",
    )

    parser.add_argument(
        "--library", "-l",
        default="chipublib",
        help="Library OverDrive identifier (default: chipublib for Chicago Public Library)",
    )

    parser.add_argument(
        "--limit", "-n",
        type=int,
        default=0,
        help="Limit number of books to search (0 for all)",
    )

    parser.add_argument(
        "--delay",
        type=float,
        default=0.3,
        help="Delay between API requests in seconds (default: 0.3)",
    )

    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Ignore cache and fetch fresh data for all books",
    )

    parser.add_argument(
        "--no-html",
        action="store_true",
        help="Don't open the HTML report in your browser (just print the table)",
    )

    parser.add_argument(
        "--gui", "-g",
        action="store_true",
        help="Open results in the desktop GUI window instead of the HTML report",
    )

    return parser.parse_args()


def load_books(source: str, console: Console) -> List[Book]:
    """Load books from Goodreads source (auto-detect type)."""
    source_type = detect_source_type(source)

    if source_type == 'url':
        rss_url = convert_goodreads_url_to_rss(source)
        console.print(f"[dim]Fetching books from Goodreads...[/dim]")
        books = fetch_from_rss(rss_url)
        console.print(f"[dim]Found {len(books)} books on your want-to-read list[/dim]")
        if len(books) >= 100:
            console.print("[yellow]Note: RSS feeds are limited to 100 books. Use a CSV export for larger lists.[/yellow]")
    else:
        console.print(f"[dim]Loading books from CSV file: {source}[/dim]")
        books = load_from_csv(source)
        console.print(f"[dim]Found {len(books)} books on your to-read shelf[/dim]")

    return books


class LiveSearcher:
    """Handles searching with live table updates."""

    def __init__(
        self,
        books: List[Book],
        client: OverDriveClient,
        cache: AvailabilityCache,
        console: Console,
        delay: float = 0.3,
        use_cache: bool = True,
    ):
        self.books = books
        self.client = client
        self.cache = cache
        self.console = console
        self.delay = delay
        self.use_cache = use_cache

        # Results tracking
        self.results: Dict[str, LibbyResult] = {}
        self.cache_ages: Dict[str, str] = {}
        self.pending_books: List[Book] = []
        self.current_book: Optional[str] = None
        self.done = False
        self.lock = threading.Lock()

    def _get_result_key(self, title: str, author: str) -> str:
        return f"{title}|{author}"

    def _load_from_cache(self) -> int:
        """Load cached results. Returns count of cache hits."""
        cache_hits = 0
        for book in self.books:
            cached = self.cache.get(book.title, book.author)
            if cached and self.use_cache:
                key = self._get_result_key(cached.title, cached.author)
                result = cached.to_libby_result()
                result.goodreads_rating = book.goodreads_rating
                self.results[key] = result
                self.cache_ages[key] = cached.age_str()
                cache_hits += 1
            else:
                self.pending_books.append(book)
        return cache_hits

    def _fetch_worker(self) -> None:
        """Background worker to fetch fresh data."""
        for book in self.pending_books:
            with self.lock:
                self.current_book = book.title

            result = self.client.search(book.title, book.author)
            if result:
                result.goodreads_rating = book.goodreads_rating
                key = self._get_result_key(result.title, result.author)
                with self.lock:
                    self.results[key] = result
                    self.cache_ages[key] = "just now"
                self.cache.set(result)

            time.sleep(self.delay)

        with self.lock:
            self.current_book = None
            self.done = True

    def _build_display(self) -> Group:
        """Build the current display."""
        with self.lock:
            results_list = list(self.results.values())
            current = self.current_book
            is_done = self.done
            pending_count = len(self.pending_books) - len([
                b for b in self.pending_books
                if self._get_result_key(b.title, b.author) in self.results
                or any(self._get_result_key(r.title, r.author) == self._get_result_key(b.title, b.author)
                       for r in results_list)
            ])

        table = build_table(results_list, self.cache_ages)

        if is_done:
            status = Text(build_summary(results_list))
        elif current:
            remaining = sum(1 for b in self.pending_books
                          if self._get_result_key(b.title, b.author) not in self.results)
            status = Text(f"Updating: {current[:40]}... ({remaining} remaining)", style="dim")
        else:
            status = Text("Loading...", style="dim")

        return Group(Text(""), table, Text(""), status)

    def run(self) -> List[LibbyResult]:
        """Run the search with live updates."""
        # Load from cache first
        cache_hits = self._load_from_cache()

        if cache_hits > 0:
            self.console.print(f"[dim]Loaded {cache_hits} books from cache[/dim]")

        if not self.pending_books:
            self.console.print(f"[dim]All books found in cache[/dim]")
            self.done = True
            # Just display the cached results
            self.console.print()
            self.console.print(build_table(list(self.results.values()), self.cache_ages))
            self.console.print()
            self.console.print(build_summary(list(self.results.values())))
            return list(self.results.values())

        if cache_hits > 0:
            self.console.print(f"[dim]Fetching {len(self.pending_books)} books from Libby...[/dim]")
        else:
            self.console.print(f"[dim]Fetching {len(self.pending_books)} books from Libby...[/dim]")

        # Start background fetch
        fetch_thread = threading.Thread(target=self._fetch_worker, daemon=True)
        fetch_thread.start()

        # Live display
        try:
            with Live(self._build_display(), console=self.console, refresh_per_second=2) as live:
                while not self.done:
                    live.update(self._build_display())
                    time.sleep(0.3)
                # Final update
                live.update(self._build_display())
        except KeyboardInterrupt:
            self.done = True
            raise

        return list(self.results.values())


def main() -> int:
    """Main entry point."""
    args = parse_args()
    console = Console()

    try:
        # Load books from Goodreads
        books = load_books(args.source, console)

        if not books:
            console.print("[red]No books found in your want-to-read list.[/red]")
            return 1

        # Apply limit if specified
        if args.limit > 0:
            books = books[:args.limit]
            console.print(f"[dim]Limiting search to first {args.limit} books[/dim]")

        # Initialize client and cache
        console.print(f"[dim]Searching library: {args.library}[/dim]")
        client = OverDriveClient(library_key=args.library)
        cache = AvailabilityCache(args.library)

        # Run live search
        searcher = LiveSearcher(
            books=books,
            client=client,
            cache=cache,
            console=console,
            delay=args.delay,
            use_cache=not args.no_cache,
        )
        results = searcher.run()

        # Present results: desktop GUI if asked, otherwise the HTML report by default.
        if results:
            if args.gui:
                from .gui import show_results
                console.print("[dim]Opening GUI...[/dim]")
                show_results(results, searcher.cache_ages)
            elif not args.no_html:
                from datetime import datetime

                from .html_report import show_html_report
                label = datetime.now().strftime("%b %d, %Y")
                path = show_html_report(results, args.library, searcher.cache_ages, label)
                console.print(f"[dim]Opened report in your browser: {path}[/dim]")

        return 0

    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted by user[/yellow]")
        return 130
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        return 1


if __name__ == "__main__":
    sys.exit(main())
