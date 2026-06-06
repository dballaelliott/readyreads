"""Tests for parsing the Goodreads average rating from RSS and CSV."""

from readyreads.goodreads import fetch_from_rss, load_from_csv

RSS_FEED = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>to-read</title>
    <item>
      <title>The Rated Book</title>
      <author_name>Jane Author</author_name>
      <book_id>111</book_id>
      <average_rating>4.27</average_rating>
      <link>https://www.goodreads.com/book/show/111</link>
      <description>isbn: 0060590297</description>
    </item>
    <item>
      <title>The Unrated Book</title>
      <author_name>John Author</author_name>
      <book_id>222</book_id>
      <average_rating></average_rating>
      <link>https://www.goodreads.com/book/show/222</link>
      <description></description>
    </item>
  </channel>
</rss>
"""


def test_rss_parses_average_rating():
    books = fetch_from_rss(RSS_FEED)
    by_title = {b.title: b for b in books}

    assert by_title["The Rated Book"].goodreads_rating == 4.27


def test_rss_missing_rating_is_none():
    books = fetch_from_rss(RSS_FEED)
    by_title = {b.title: b for b in books}

    assert by_title["The Unrated Book"].goodreads_rating is None


def test_csv_parses_average_rating(tmp_path):
    csv_file = tmp_path / "export.csv"
    csv_file.write_text(
        "Title,Author,ISBN,ISBN13,Book Id,Average Rating,Exclusive Shelf\n"
        'Rated Title,Jane Author,="0060590297",="9780060590291",111,3.91,to-read\n'
        'No Rating,John Author,="",="",222,,to-read\n'
    )

    books = load_from_csv(csv_file)
    by_title = {b.title: b for b in books}

    assert by_title["Rated Title"].goodreads_rating == 3.91
    assert by_title["No Rating"].goodreads_rating is None
