"""Goodreads data fetching - RSS feed and CSV parsing."""

import csv
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Union

import feedparser


@dataclass
class Book:
    """A book from the Goodreads want-to-read list."""
    title: str
    author: str
    isbn: Optional[str] = None
    isbn13: Optional[str] = None
    goodreads_id: Optional[str] = None
    goodreads_rating: Optional[float] = None


class GoodreadsError(Exception):
    """Error fetching from Goodreads."""
    pass


def fetch_from_rss(url: str) -> List[Book]:
    """Fetch books from a Goodreads RSS feed URL.

    Note: Goodreads RSS feeds are limited to 100 items.

    Raises:
        GoodreadsError: If the feed cannot be accessed (e.g., 401 Unauthorized)
    """
    feed = feedparser.parse(url)

    # Check for HTTP errors
    status = feed.get("status", 200)
    if status == 401 or (feed.bozo and not feed.entries):
        raise GoodreadsError(
            "Could not access Goodreads feed (401 Unauthorized).\n\n"
            "To get your RSS feed URL:\n"
            "  1. Go to goodreads.com and sign in\n"
            "  2. Click 'My Books' -> your 'Want to Read' shelf\n"
            "  3. Click the 'RSS' link at the bottom of the page\n"
            "  4. Copy that URL (it includes a secret key)\n\n"
            "Example: https://www.goodreads.com/review/list_rss/12345?key=ABC123&shelf=to-read"
        )

    books = []

    for entry in feed.entries:
        title = entry.get("title", "")
        author = entry.get("author_name", "")

        # Extract ISBN from description if available
        isbn = None
        isbn13 = None
        description = entry.get("description", "")

        # Try to find ISBN in the entry
        isbn_match = re.search(r'isbn:\s*(\d{10})', description, re.IGNORECASE)
        if isbn_match:
            isbn = isbn_match.group(1)

        isbn13_match = re.search(r'isbn13:\s*(\d{13})', description, re.IGNORECASE)
        if isbn13_match:
            isbn13 = isbn13_match.group(1)

        # Get Goodreads book ID from link
        goodreads_id = None
        link = entry.get("link", "")
        id_match = re.search(r'/book/show/(\d+)', link)
        if id_match:
            goodreads_id = id_match.group(1)

        if title and author:
            books.append(Book(
                title=clean_title(title),
                author=author,
                isbn=isbn,
                isbn13=isbn13,
                goodreads_id=goodreads_id,
                goodreads_rating=parse_rating(entry.get("average_rating")),
            ))

    return books


def load_from_csv(filepath: Union[str, Path]) -> List[Book]:
    """Load books from a Goodreads CSV export file.

    Filters for books on the 'to-read' shelf only.
    """
    books = []
    filepath = Path(filepath)

    with open(filepath, encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for row in reader:
            # Filter for to-read shelf
            shelf = row.get("Exclusive Shelf", "").strip()
            if shelf != "to-read":
                continue

            title = row.get("Title", "").strip()
            author = row.get("Author", "").strip()

            # Clean up ISBN fields (Goodreads exports them with ="..." format)
            isbn = clean_isbn(row.get("ISBN", ""))
            isbn13 = clean_isbn(row.get("ISBN13", ""))
            goodreads_id = row.get("Book Id", "").strip()

            if title and author:
                books.append(Book(
                    title=clean_title(title),
                    author=author,
                    isbn=isbn if isbn else None,
                    isbn13=isbn13 if isbn13 else None,
                    goodreads_id=goodreads_id if goodreads_id else None,
                    goodreads_rating=parse_rating(row.get("Average Rating")),
                ))

    return books


def parse_rating(value: Optional[str]) -> Optional[float]:
    """Parse a Goodreads average rating into a float, or None if absent/invalid.

    Goodreads reports a 0 average rating for unrated books; treat that as None.
    """
    if value is None:
        return None
    value = str(value).strip()
    if not value:
        return None
    try:
        rating = float(value)
    except ValueError:
        return None
    return rating if rating > 0 else None


def clean_isbn(value: str) -> str:
    """Clean ISBN values from Goodreads CSV format.

    Goodreads exports ISBNs as ="0060590297" or ="" format.
    """
    value = value.strip()
    # Remove ="..." wrapper
    if value.startswith('="') and value.endswith('"'):
        value = value[2:-1]
    # Remove any remaining quotes
    value = value.strip('"')
    return value


def clean_title(title: str) -> str:
    """Clean up book title by removing series info in parentheses."""
    # Remove series info like "(The Expanse, #1)" at the end
    cleaned = re.sub(r'\s*\([^)]*#\d+[^)]*\)\s*$', '', title)
    return cleaned.strip()
