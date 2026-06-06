"""The terminal table should surface the Goodreads rating."""

from rich.console import Console

from readyreads.display import build_table
from readyreads.overdrive import AvailabilityStatus, FormatAvailability, LibbyResult


def _render(table) -> str:
    console = Console(width=120)
    with console.capture() as cap:
        console.print(table)
    return cap.get()


def test_table_shows_rating():
    r = LibbyResult(
        title="Dune", author="Frank Herbert",
        ebook=FormatAvailability(status=AvailabilityStatus.AVAILABLE),
        goodreads_rating=4.27,
    )
    text = _render(build_table([r]))
    assert "4.27" in text


def test_table_blank_when_rating_missing():
    r = LibbyResult(
        title="Mystery", author="Nobody",
        ebook=FormatAvailability(status=AvailabilityStatus.AVAILABLE),
        goodreads_rating=None,
    )
    # Should render without error and without a bogus 0.00.
    text = _render(build_table([r]))
    assert "0.00" not in text
    assert "Mystery" in text
