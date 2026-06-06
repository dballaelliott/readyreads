"""Tests for the tiered availability sort."""

from readyreads.display import sort_results
from readyreads.overdrive import AvailabilityStatus, FormatAvailability, LibbyResult


def _avail(status, wait_days=None):
    return FormatAvailability(status=status, wait_days=wait_days)


def _result(title, *, ebook=None, audio=None, rating=None):
    return LibbyResult(
        title=title,
        author="Author",
        ebook=ebook,
        audiobook=audio,
        goodreads_rating=rating,
    )


AVAILABLE = AvailabilityStatus.AVAILABLE
WAITLIST = AvailabilityStatus.WAITLIST
NOT_FOUND = AvailabilityStatus.NOT_FOUND


def test_not_found_anywhere_is_lowest_tier():
    from readyreads.display import availability_tier

    unmatched = _result("X", ebook=_avail(NOT_FOUND), audio=_avail(NOT_FOUND))
    waitlisted = _result("Y", ebook=_avail(WAITLIST, wait_days=10))

    assert availability_tier(unmatched) == 3
    assert availability_tier(waitlisted) == 2


def test_ebook_available_sorts_before_audio_only_sorts_before_rest():
    ebook_avail = _result("EbookAvail", ebook=_avail(AVAILABLE), rating=3.0)
    audio_only = _result(
        "AudioOnly", ebook=_avail(NOT_FOUND), audio=_avail(AVAILABLE), rating=5.0
    )
    waitlisted = _result("Waitlisted", ebook=_avail(WAITLIST, wait_days=10), rating=5.0)

    ordered = sort_results([waitlisted, audio_only, ebook_avail])

    assert [r.title for r in ordered] == ["EbookAvail", "AudioOnly", "Waitlisted"]


def test_within_tier_higher_rating_first_when_wait_equal():
    low = _result("Low", ebook=_avail(AVAILABLE), rating=3.5)
    high = _result("High", ebook=_avail(AVAILABLE), rating=4.8)

    ordered = sort_results([low, high])

    assert [r.title for r in ordered] == ["High", "Low"]


def test_within_tier_shorter_ebook_wait_first_then_rating():
    long_wait = _result("LongWait", ebook=_avail(WAITLIST, wait_days=60), rating=5.0)
    short_wait_low = _result("ShortLow", ebook=_avail(WAITLIST, wait_days=7), rating=2.0)
    short_wait_high = _result("ShortHigh", ebook=_avail(WAITLIST, wait_days=7), rating=4.0)

    ordered = sort_results([long_wait, short_wait_low, short_wait_high])

    assert [r.title for r in ordered] == ["ShortHigh", "ShortLow", "LongWait"]


def test_tier_dominates_rating():
    # Audio-only book is rated higher but ebook-available still wins.
    ebook_avail = _result("EbookAvail", ebook=_avail(AVAILABLE), rating=1.0)
    audio_only = _result(
        "AudioOnly", ebook=_avail(NOT_FOUND), audio=_avail(AVAILABLE), rating=5.0
    )

    ordered = sort_results([audio_only, ebook_avail])

    assert [r.title for r in ordered] == ["EbookAvail", "AudioOnly"]


def test_missing_rating_sorts_last_within_tier():
    rated = _result("Rated", ebook=_avail(AVAILABLE), rating=3.0)
    unrated = _result("Unrated", ebook=_avail(AVAILABLE), rating=None)

    ordered = sort_results([unrated, rated])

    assert [r.title for r in ordered] == ["Rated", "Unrated"]
