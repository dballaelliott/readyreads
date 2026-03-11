"""Display formatting using Rich tables."""

from typing import Dict, List, Optional

from rich.console import Console
from rich.live import Live
from rich.table import Table

from .overdrive import AvailabilityStatus, FormatAvailability, LibbyResult


def format_availability(avail: Optional[FormatAvailability]) -> str:
    """Format availability status for display."""
    if avail is None:
        return "[dim]--[/dim]"

    if avail.status == AvailabilityStatus.AVAILABLE:
        return "[green]Available[/green]"

    if avail.status == AvailabilityStatus.WAITLIST:
        if avail.wait_days:
            if avail.wait_days <= 7:
                return f"[yellow]~{avail.wait_days}d wait[/yellow]"
            elif avail.wait_days <= 30:
                weeks = avail.wait_days // 7
                return f"[yellow]~{weeks}w wait[/yellow]"
            else:
                months = avail.wait_days // 30
                return f"[red]~{months}mo wait[/red]"
        elif avail.holds_count:
            return f"[yellow]{avail.holds_count} holds[/yellow]"
        return "[yellow]Waitlist[/yellow]"

    return "[dim]Not found[/dim]"


def sort_key(r: LibbyResult) -> int:
    """Sort key for results: available first, then waitlist, then not found."""
    score = 0
    if r.ebook and r.ebook.status == AvailabilityStatus.AVAILABLE:
        score -= 10
    if r.audiobook and r.audiobook.status == AvailabilityStatus.AVAILABLE:
        score -= 10
    if r.ebook and r.ebook.status == AvailabilityStatus.WAITLIST:
        score -= 5
    if r.audiobook and r.audiobook.status == AvailabilityStatus.WAITLIST:
        score -= 5
    return score


def build_table(
    results: List[LibbyResult],
    cache_ages: Optional[Dict[str, str]] = None,
    title: str = "Libby Availability for Your Want-to-Read List",
) -> Table:
    """Build a Rich table from results."""
    table = Table(title=title)

    table.add_column("Title", style="cyan", no_wrap=False, max_width=35)
    table.add_column("Author", style="white", no_wrap=False, max_width=20)
    table.add_column("Ebook", justify="center", no_wrap=True)
    table.add_column("Audiobook", justify="center", no_wrap=True)

    if cache_ages:
        table.add_column("Updated", justify="right", style="dim", no_wrap=True)

    sorted_results = sorted(results, key=sort_key)

    for result in sorted_results:
        row = [
            result.title,
            result.author,
            format_availability(result.ebook),
            format_availability(result.audiobook),
        ]
        if cache_ages:
            key = f"{result.title}|{result.author}"
            age = cache_ages.get(key, "")
            row.append(age)

        table.add_row(*row)

    return table


def build_summary(results: List[LibbyResult]) -> str:
    """Build summary text."""
    available_count = sum(
        1 for r in results
        if (r.ebook and r.ebook.status == AvailabilityStatus.AVAILABLE) or
           (r.audiobook and r.audiobook.status == AvailabilityStatus.AVAILABLE)
    )
    waitlist_count = sum(
        1 for r in results
        if (r.ebook and r.ebook.status == AvailabilityStatus.WAITLIST) or
           (r.audiobook and r.audiobook.status == AvailabilityStatus.WAITLIST)
    )
    not_found_count = sum(
        1 for r in results
        if (r.ebook and r.ebook.status == AvailabilityStatus.NOT_FOUND) and
           (r.audiobook and r.audiobook.status == AvailabilityStatus.NOT_FOUND)
    )

    return f"[bold]Summary:[/bold] {available_count} available now, {waitlist_count} on waitlist, {not_found_count} not in collection"


def display_results(
    results: List[LibbyResult],
    console: Optional[Console] = None,
    cache_ages: Optional[Dict[str, str]] = None,
) -> None:
    """Display search results in a formatted table."""
    if console is None:
        console = Console()

    table = build_table(results, cache_ages)

    console.print()
    console.print(table)
    console.print()
    console.print(build_summary(results))
