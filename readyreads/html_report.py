"""Self-contained HTML availability report with a library card-catalog aesthetic."""

import html
import tempfile
import webbrowser
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import quote

from .display import availability_tier, sort_results
from .overdrive import AvailabilityStatus, FormatAvailability, LibbyResult

# --- URLs -------------------------------------------------------------------


def libby_url(library_key: str, result: LibbyResult) -> Optional[str]:
    """Build the OverDrive/Libby title-page URL, or None if we have no id."""
    if not result.overdrive_id:
        return None
    return f"https://{library_key}.overdrive.com/media/{result.overdrive_id}"


def search_url(library_key: str, title: str) -> str:
    """Build an OverDrive search URL for manually finding an unmatched title."""
    return f"https://{library_key}.overdrive.com/search?query={quote(title)}"


# --- small formatting helpers ----------------------------------------------


def _wait_text(avail: FormatAvailability) -> str:
    """Human wait label, e.g. '~3w' or '5 holds'."""
    if avail.wait_days:
        d = avail.wait_days
        if d <= 7:
            return f"~{d}d"
        if d <= 30:
            return f"~{d // 7}w"
        return f"~{d // 30}mo"
    if avail.holds_count:
        return f"{avail.holds_count} holds"
    return "waitlist"


def _badge(avail: Optional[FormatAvailability], fmt: str) -> str:
    """Render one rubber-stamp availability badge for a format."""
    if avail is None or avail.status == AvailabilityStatus.NOT_FOUND:
        return f'<span class="stamp none">{fmt} · —</span>'
    if avail.status == AvailabilityStatus.AVAILABLE:
        return f'<span class="stamp avail">{fmt} · now</span>'
    # waitlist
    wait = avail.wait_days or 0
    cls = "long" if wait > 30 else "wait"
    return f'<span class="stamp {cls}">{fmt} · {_wait_text(avail)}</span>'


def _stars(rating: Optional[float]) -> str:
    """Render a five-star glyph row plus the numeric rating."""
    if not rating:
        return '<span class="rating none">unrated</span>'
    filled = max(0, min(5, int(round(rating))))
    glyphs = "".join(
        f'<span class="{"on" if i < filled else "off"}">★</span>' for i in range(5)
    )
    return (
        f'<span class="rating" title="Goodreads average">'
        f'<span class="glyphs">{glyphs}</span>'
        f'<span class="num">{rating:.2f}</span></span>'
    )


# --- section model ----------------------------------------------------------

_SECTIONS = [
    ("Drawer 01", "Ready to read", "available as ebook"),
    ("Drawer 02", "Listen instead", "audiobook available, ebook isn’t"),
    ("Drawer 03", "Worth the wait", "on the waitlist"),
    ("Archive", "Failed to match", "no ebook or audiobook found in the collection"),
]

_FAILED_TIER = 3


def _card(
    result: LibbyResult,
    library_key: str,
    cache_ages: Dict[str, str],
    idx: int,
    failed: bool = False,
) -> str:
    title = html.escape(result.title)
    author = html.escape(result.author)

    # For unmatched books the media id is an unreliable fallback guess, so send
    # the reader to a Libby search instead of a possibly-wrong title page.
    url = search_url(library_key, result.title) if failed else libby_url(library_key, result)

    if url:
        cls = "title search" if failed else "title"
        title_html = (
            f'<a class="{cls}" href="{html.escape(url)}" '
            f'target="_blank" rel="noopener">{title}</a>'
        )
    else:
        title_html = f'<span class="title nolink">{title}</span>'

    age = cache_ages.get(f"{result.title}|{result.author}", "")
    age_html = f'<span class="updated">{html.escape(age)}</span>' if age else ""

    return (
        f'<article class="card" style="animation-delay:{idx * 40}ms">'
        f'<div class="card-main">{title_html}'
        f'<div class="byline">{author}</div></div>'
        f'<div class="card-meta">'
        f'{_stars(result.goodreads_rating)}'
        f'<div class="badges">{_badge(result.ebook, "ebook")}'
        f'{_badge(result.audiobook, "audio")}</div>'
        f'{age_html}</div></article>'
    )


def build_html(
    results: List[LibbyResult],
    library_key: str,
    cache_ages: Optional[Dict[str, str]] = None,
    generated_label: Optional[str] = None,
) -> str:
    """Render the full self-contained HTML report string."""
    cache_ages = cache_ages or {}
    ordered = sort_results(results)

    buckets: Dict[int, List[LibbyResult]] = {0: [], 1: [], 2: [], 3: []}
    for r in ordered:
        buckets[availability_tier(r)].append(r)

    sections_html = []
    idx = 0
    for tier, (kicker, label, sub) in enumerate(_SECTIONS):
        items = buckets[tier]
        if not items:
            continue
        failed = tier == _FAILED_TIER
        cards = []
        for r in items:
            cards.append(_card(r, library_key, cache_ages, idx, failed=failed))
            idx += 1
        head = (
            f'<span class="kicker">{html.escape(kicker)}</span>'
            f'<h2>{html.escape(label)}</h2>'
            f'<span class="drawer-sub">{html.escape(sub)} · {len(items)}</span>'
        )
        if failed:
            # Collapsed by default — no `open` attribute.
            sections_html.append(
                f'<details class="drawer failed"><summary class="drawer-head">{head}</summary>'
                f'<div class="cards">{"".join(cards)}</div></details>'
            )
        else:
            sections_html.append(
                f'<section class="drawer"><header class="drawer-head">{head}</header>'
                f'<div class="cards">{"".join(cards)}</div></section>'
            )

    body = "".join(sections_html) or (
        '<section class="drawer"><p class="empty">No books to show.</p></section>'
    )

    avail_count = len(buckets[0]) + len(buckets[1])
    total = len(results)
    stamp = html.escape(generated_label) if generated_label else ""
    lib = html.escape(library_key)

    return _DOCUMENT.format(
        css=_CSS,
        library=lib,
        stamp=stamp,
        total=total,
        avail=avail_count,
        body=body,
    )


def show_html_report(
    results: List[LibbyResult],
    library_key: str,
    cache_ages: Optional[Dict[str, str]] = None,
    generated_label: Optional[str] = None,
) -> Path:
    """Write the report to a temp file and open it in the default browser."""
    doc = build_html(results, library_key, cache_ages, generated_label)
    path = Path(tempfile.gettempdir()) / f"readyreads-{library_key}.html"
    path.write_text(doc, encoding="utf-8")
    webbrowser.open(path.as_uri())
    return path


# --- presentation -----------------------------------------------------------

_CSS = """
:root{
  --paper:#f3ead6; --paper-2:#ece0c6; --card:#fbf5e6;
  --ink:#2c2620; --ink-soft:#7a6c57; --rule:#cdba94;
  --stamp:#b23a25; --avail:#2f6b43; --wait:#9a6a16; --long:#a33523;
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-font-smoothing:antialiased}
body{
  font-family:'Newsreader',Georgia,serif;
  color:var(--ink); background:var(--paper);
  line-height:1.5; padding:48px 20px 96px;
}
body::before{
  content:""; position:fixed; inset:0; pointer-events:none; z-index:0;
  opacity:.05; mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
.wrap{max-width:880px;margin:0 auto;position:relative;z-index:1}

/* masthead — a library card header */
.masthead{
  border:2px solid var(--ink); border-radius:3px; background:var(--card);
  padding:26px 30px; display:flex; justify-content:space-between;
  align-items:flex-start; gap:24px; box-shadow:6px 8px 0 rgba(44,38,32,.12);
}
.brand .eyebrow{
  font-family:'Space Mono',monospace; font-size:11px; letter-spacing:.32em;
  text-transform:uppercase; color:var(--ink-soft);
}
.brand h1{
  font-family:'Fraunces',serif; font-weight:600; font-size:54px;
  line-height:.95; letter-spacing:-.02em; font-optical-sizing:auto;
}
.brand .tag{font-style:italic;color:var(--ink-soft);font-size:17px;margin-top:6px}
.due-stamp{
  font-family:'Space Mono',monospace; text-transform:uppercase;
  border:2px solid var(--stamp); color:var(--stamp); border-radius:4px;
  padding:8px 12px; text-align:center; transform:rotate(4deg);
  font-size:11px; letter-spacing:.12em; line-height:1.7; flex:none;
  box-shadow:inset 0 0 0 2px rgba(178,58,37,.15);
}
.due-stamp b{display:block;font-size:13px;letter-spacing:.18em}

.summary{
  font-family:'Space Mono',monospace; font-size:12.5px; letter-spacing:.08em;
  color:var(--ink-soft); margin:22px 4px 8px; text-transform:uppercase;
}
.summary b{color:var(--avail)}

/* drawers */
.drawer{margin-top:40px}
.drawer-head{
  display:flex; align-items:baseline; gap:14px; flex-wrap:wrap;
  border-bottom:2px solid var(--ink); padding-bottom:8px;
}
.kicker{
  font-family:'Space Mono',monospace; font-size:11px; letter-spacing:.2em;
  text-transform:uppercase; color:var(--paper); background:var(--ink);
  padding:3px 8px; border-radius:2px;
}
.drawer-head h2{
  font-family:'Fraunces',serif; font-weight:600; font-size:27px;
  letter-spacing:-.01em;
}
.drawer-sub{
  font-family:'Space Mono',monospace; font-size:11px; letter-spacing:.06em;
  color:var(--ink-soft); text-transform:uppercase; margin-left:auto;
}

.cards{margin-top:4px}
.card{
  display:flex; justify-content:space-between; align-items:center; gap:20px;
  padding:16px 6px; border-bottom:1px solid var(--rule);
  opacity:0; transform:translateY(8px);
  animation:rise .5s cubic-bezier(.2,.7,.2,1) forwards;
}
@keyframes rise{to{opacity:1;transform:none}}
.card:hover{background:linear-gradient(90deg,rgba(178,58,37,.05),transparent)}
.card-main{min-width:0}
.title{
  font-family:'Fraunces',serif; font-size:21px; font-weight:500;
  color:var(--ink); text-decoration:none; letter-spacing:-.01em;
  background-image:linear-gradient(var(--stamp),var(--stamp));
  background-size:0% 1.5px; background-position:0 100%;
  background-repeat:no-repeat; transition:background-size .3s ease,color .2s;
}
.title:hover{color:var(--stamp);background-size:100% 1.5px}
.title.nolink{color:var(--ink-soft);cursor:default}
.byline{font-style:italic;color:var(--ink-soft);font-size:15px;margin-top:2px}
.byline::before{content:"by ";font-style:normal;opacity:.6}

.card-meta{display:flex;align-items:center;gap:16px;flex:none}
.rating{display:flex;flex-direction:column;align-items:flex-end;gap:1px}
.rating .glyphs{letter-spacing:1px;font-size:14px;line-height:1}
.rating .on{color:var(--wait)} .rating .off{color:var(--rule)}
.rating .num{font-family:'Space Mono',monospace;font-size:11px;color:var(--ink-soft)}
.rating.none{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--rule)}

.badges{display:flex;flex-direction:column;gap:5px;align-items:flex-end;width:118px}
.stamp{
  font-family:'Space Mono',monospace; font-size:10.5px; letter-spacing:.06em;
  text-transform:uppercase; padding:3px 8px; border-radius:3px;
  border:1.5px solid currentColor; white-space:nowrap;
}
.stamp.avail{color:var(--avail);background:rgba(47,107,67,.1)}
.stamp.wait{color:var(--wait);background:rgba(154,106,22,.1)}
.stamp.long{color:var(--long);background:rgba(163,53,35,.1)}
.stamp.none{color:var(--rule);border-style:dashed}
.updated{font-family:'Space Mono',monospace;font-size:10px;color:var(--ink-soft);
  width:60px;text-align:right}
.empty{font-style:italic;color:var(--ink-soft);padding:24px 4px}

/* collapsed "failed to match" archive */
.drawer.failed{margin-top:52px}
.drawer.failed summary{cursor:pointer;list-style:none;opacity:.75;transition:opacity .2s}
.drawer.failed summary:hover{opacity:1}
.drawer.failed summary::-webkit-details-marker{display:none}
.drawer.failed summary::before{
  content:"▸"; margin-right:-4px; color:var(--ink-soft);
  font-size:13px; transition:transform .2s; display:inline-block;
}
.drawer.failed[open] summary::before{transform:rotate(90deg)}
.drawer.failed[open] summary{opacity:1}
.drawer.failed h2{color:var(--ink-soft)}
.drawer.failed .kicker{background:var(--ink-soft)}
.drawer.failed .cards{opacity:.85}
.title.search{font-style:italic}
.title.search::after{
  content:"↗ search"; font-family:'Space Mono',monospace; font-style:normal;
  font-size:9px; letter-spacing:.08em; text-transform:uppercase;
  color:var(--ink-soft); margin-left:8px; vertical-align:middle;
}

@media(max-width:620px){
  .card{flex-direction:column;align-items:flex-start;gap:10px}
  .card-meta{align-items:flex-start}
  .badges,.rating{align-items:flex-start}
  .brand h1{font-size:40px}
}
"""

_DOCUMENT = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>readyreads · borrowing report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Newsreader:ital,opsz@0,6..72;1,6..72&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>{css}</style>
</head>
<body>
<div class="wrap">
  <header class="masthead">
    <div class="brand">
      <div class="eyebrow">Public Library · {library}</div>
      <h1>readyreads</h1>
      <div class="tag">your want-to-read list, sorted by what you can borrow now</div>
    </div>
    <div class="due-stamp">Generated<b>{stamp}</b></div>
  </header>
  <p class="summary"><b>{avail}</b> available now · {total} titles checked</p>
  {body}
</div>
</body>
</html>
"""
