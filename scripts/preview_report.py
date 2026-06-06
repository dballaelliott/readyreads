"""Generate a sample HTML report for visual review (not part of the package)."""

from readyreads.html_report import build_html
from readyreads.overdrive import AvailabilityStatus, FormatAvailability, LibbyResult

A = AvailabilityStatus.AVAILABLE
W = AvailabilityStatus.WAITLIST
N = AvailabilityStatus.NOT_FOUND


def fa(status, wait=None, holds=None):
    return FormatAvailability(status=status, wait_days=wait, holds_count=holds)


def r(title, author, eb, au, rating, oid="100"):
    return LibbyResult(title=title, author=author, ebook=eb, audiobook=au,
                       goodreads_rating=rating, overdrive_id=oid)


results = [
    r("The Fifth Season", "N. K. Jemisin", fa(A), fa(A), 4.34, "111"),
    r("Piranesi", "Susanna Clarke", fa(A), fa(W, 21), 4.25, "112"),
    r("Babel", "R. F. Kuang", fa(A), fa(N), 4.16, "113"),
    r("The Will of the Many", "James Islington", fa(N), fa(A), 4.55, "114"),
    r("Cats & Dogs <Annotated>", "A. Author", fa(N), fa(A), 3.20, "115"),
    r("The Priory of the Orange Tree", "Samantha Shannon", fa(W, 7), fa(W, 60), 4.40, "116"),
    r("Tomorrow x3", "Gabrielle Zevin", fa(W, 95), fa(W, 120), 4.18, "117"),
    r("Some Obscure Title", "Unknown", fa(N), fa(N), None, ""),
]

cache_ages = {f"{x.title}|{x.author}": age for x, age in zip(
    results, ["just now", "2h ago", "1d ago", "just now", "3d ago", "5d ago", "1mo ago", "just now"]
)}

html = build_html(results, "chipublib", cache_ages, generated_label="Jun 01, 2026")
out = "/tmp/readyreads-preview.html"
with open(out, "w", encoding="utf-8") as f:
    f.write(html)
print(out)
