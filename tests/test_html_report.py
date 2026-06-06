"""Tests for the HTML report generation (structure and data, not aesthetics)."""

from readyreads.html_report import build_html, libby_url
from readyreads.overdrive import AvailabilityStatus, FormatAvailability, LibbyResult


def _avail(status, wait_days=None):
    return FormatAvailability(status=status, wait_days=wait_days)


AVAILABLE = AvailabilityStatus.AVAILABLE
WAITLIST = AvailabilityStatus.WAITLIST
NOT_FOUND = AvailabilityStatus.NOT_FOUND


def test_libby_url_built_from_library_and_id():
    r = LibbyResult(title="T", author="A", overdrive_id="123456")
    assert libby_url("chipublib", r) == "https://chipublib.overdrive.com/media/123456"


def test_libby_url_none_without_id():
    r = LibbyResult(title="T", author="A", overdrive_id=None)
    assert libby_url("chipublib", r) is None


def test_report_contains_title_and_libby_link():
    r = LibbyResult(
        title="Dune", author="Frank Herbert", overdrive_id="999",
        ebook=_avail(AVAILABLE), goodreads_rating=4.27,
    )
    html = build_html([r], "chipublib")

    assert "Dune" in html
    assert "https://chipublib.overdrive.com/media/999" in html
    assert "4.27" in html


def test_report_escapes_html_in_titles():
    r = LibbyResult(title="Cats & Dogs <Vol 1>", author="A & B", overdrive_id="1")
    html = build_html([r], "chipublib")

    assert "Cats &amp; Dogs &lt;Vol 1&gt;" in html
    assert "Cats & Dogs <Vol 1>" not in html


def test_report_orders_ebook_available_before_audio_only():
    ebook = LibbyResult(title="AlphaEbook", author="A", ebook=_avail(AVAILABLE))
    audio = LibbyResult(
        title="BetaAudio", author="B", ebook=_avail(NOT_FOUND), audiobook=_avail(AVAILABLE)
    )
    html = build_html([audio, ebook], "chipublib")

    assert html.index("AlphaEbook") < html.index("BetaAudio")


def test_report_has_tier_section_labels():
    r = LibbyResult(title="X", author="A", ebook=_avail(AVAILABLE))
    html = build_html([r], "chipublib")

    # The three drawer/section labels should be present.
    assert "ebook" in html.lower()
    assert "audio" in html.lower()


def test_search_url_encodes_query():
    from readyreads.html_report import search_url

    assert search_url("chipublib", "Cats & Dogs") == (
        "https://chipublib.overdrive.com/search?query=Cats%20%26%20Dogs"
    )


def test_unmatched_books_go_in_collapsed_failed_section():
    unmatched = LibbyResult(
        title="GhostBook", author="Nobody", overdrive_id="55",
        ebook=_avail(NOT_FOUND), audiobook=_avail(NOT_FOUND),
    )
    html = build_html([unmatched], "chipublib")

    assert "GhostBook" in html
    assert "<details" in html
    # Collapsed by default -> no `open` attribute.
    assert "<details open" not in html
    assert "Failed to match" in html
    # Failed cards link to a search, not the unreliable media id.
    assert "overdrive.com/search?query=" in html
    assert "media/55" not in html


def test_no_failed_section_when_everything_matched():
    waitlisted = LibbyResult(
        title="Held", author="A", ebook=_avail(WAITLIST, 10)
    )
    html = build_html([waitlisted], "chipublib")

    assert "<details" not in html
    assert "Failed to match" not in html


def test_empty_results_still_valid_html():
    html = build_html([], "chipublib")
    assert "<html" in html.lower()
    assert "</html>" in html.lower()
