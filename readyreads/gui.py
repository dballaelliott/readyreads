"""Minimalist GUI for readyreads."""

import tkinter as tk
from tkinter import ttk
from typing import Dict, List, Optional

from .overdrive import AvailabilityStatus, LibbyResult


# Colors - minimalist palette
COLORS = {
    "bg": "#1a1a1a",
    "fg": "#e0e0e0",
    "accent": "#3d85c6",
    "available": "#4caf50",
    "waitlist": "#ff9800",
    "waitlist_long": "#f44336",
    "not_found": "#666666",
    "header_bg": "#252525",
    "row_alt": "#222222",
    "border": "#333333",
}


def format_availability(status: AvailabilityStatus, wait_days: Optional[int], holds: Optional[int]) -> tuple:
    """Format availability for display. Returns (text, color)."""
    if status == AvailabilityStatus.AVAILABLE:
        return ("Available", COLORS["available"])

    if status == AvailabilityStatus.WAITLIST:
        if wait_days:
            if wait_days <= 7:
                return (f"~{wait_days}d wait", COLORS["waitlist"])
            elif wait_days <= 30:
                weeks = wait_days // 7
                return (f"~{weeks}w wait", COLORS["waitlist"])
            else:
                months = wait_days // 30
                return (f"~{months}mo wait", COLORS["waitlist_long"])
        elif holds:
            return (f"{holds} holds", COLORS["waitlist"])
        return ("Waitlist", COLORS["waitlist"])

    return ("Not found", COLORS["not_found"])


class ResultsWindow:
    """A minimalist window displaying search results."""

    def __init__(self, results: List[LibbyResult], cache_ages: Optional[Dict[str, str]] = None):
        self.results = results
        self.cache_ages = cache_ages or {}

        self.root = tk.Tk()
        self.root.title("readyreads")
        self.root.configure(bg=COLORS["bg"])

        # Window size and position
        width, height = 900, 600
        screen_w = self.root.winfo_screenwidth()
        screen_h = self.root.winfo_screenheight()
        x = (screen_w - width) // 2
        y = (screen_h - height) // 2
        self.root.geometry(f"{width}x{height}+{x}+{y}")

        # Allow resize
        self.root.minsize(600, 400)

        self._setup_styles()
        self._create_widgets()
        self._populate_table()

    def _setup_styles(self):
        """Configure ttk styles for minimalist look."""
        style = ttk.Style()
        style.theme_use("clam")

        # Treeview (table) styling
        style.configure(
            "Custom.Treeview",
            background=COLORS["bg"],
            foreground=COLORS["fg"],
            fieldbackground=COLORS["bg"],
            borderwidth=0,
            font=("SF Pro Display", 12),
            rowheight=32,
        )
        style.configure(
            "Custom.Treeview.Heading",
            background=COLORS["header_bg"],
            foreground=COLORS["fg"],
            borderwidth=0,
            font=("SF Pro Display", 12, "bold"),
            padding=(10, 8),
        )
        style.map(
            "Custom.Treeview",
            background=[("selected", COLORS["accent"])],
            foreground=[("selected", "#ffffff")],
        )
        style.map(
            "Custom.Treeview.Heading",
            background=[("active", COLORS["header_bg"])],
        )

        # Scrollbar styling
        style.configure(
            "Custom.Vertical.TScrollbar",
            background=COLORS["border"],
            troughcolor=COLORS["bg"],
            borderwidth=0,
            arrowsize=0,
        )

    def _create_widgets(self):
        """Create the main widgets."""
        # Main container with padding
        container = tk.Frame(self.root, bg=COLORS["bg"], padx=20, pady=20)
        container.pack(fill=tk.BOTH, expand=True)

        # Title
        title = tk.Label(
            container,
            text="Libby Availability",
            font=("SF Pro Display", 24, "bold"),
            bg=COLORS["bg"],
            fg=COLORS["fg"],
        )
        title.pack(anchor="w", pady=(0, 5))

        # Subtitle with count
        available_count = sum(
            1 for r in self.results
            if (r.ebook and r.ebook.status == AvailabilityStatus.AVAILABLE) or
               (r.audiobook and r.audiobook.status == AvailabilityStatus.AVAILABLE)
        )
        subtitle = tk.Label(
            container,
            text=f"{len(self.results)} books · {available_count} available now",
            font=("SF Pro Display", 13),
            bg=COLORS["bg"],
            fg=COLORS["not_found"],
        )
        subtitle.pack(anchor="w", pady=(0, 20))

        # Table frame
        table_frame = tk.Frame(container, bg=COLORS["border"])
        table_frame.pack(fill=tk.BOTH, expand=True)

        # Columns
        columns = ("title", "author", "ebook", "audiobook", "updated")
        self.tree = ttk.Treeview(
            table_frame,
            columns=columns,
            show="headings",
            style="Custom.Treeview",
            selectmode="browse",
        )

        # Column headings and widths
        self.tree.heading("title", text="Title", anchor="w")
        self.tree.heading("author", text="Author", anchor="w")
        self.tree.heading("ebook", text="Ebook", anchor="center")
        self.tree.heading("audiobook", text="Audiobook", anchor="center")
        self.tree.heading("updated", text="Updated", anchor="e")

        self.tree.column("title", width=280, minwidth=150, anchor="w")
        self.tree.column("author", width=180, minwidth=100, anchor="w")
        self.tree.column("ebook", width=120, minwidth=80, anchor="center")
        self.tree.column("audiobook", width=120, minwidth=80, anchor="center")
        self.tree.column("updated", width=100, minwidth=70, anchor="e")

        # Scrollbar
        scrollbar = ttk.Scrollbar(
            table_frame,
            orient=tk.VERTICAL,
            command=self.tree.yview,
            style="Custom.Vertical.TScrollbar",
        )
        self.tree.configure(yscrollcommand=scrollbar.set)

        # Pack table and scrollbar
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # Tags for coloring
        self.tree.tag_configure("available", foreground=COLORS["available"])
        self.tree.tag_configure("waitlist", foreground=COLORS["waitlist"])
        self.tree.tag_configure("waitlist_long", foreground=COLORS["waitlist_long"])
        self.tree.tag_configure("not_found", foreground=COLORS["not_found"])
        self.tree.tag_configure("alt", background=COLORS["row_alt"])

    def _populate_table(self):
        """Fill the table with results."""
        # Sort: available first, then waitlist, then not found
        def sort_key(r: LibbyResult) -> int:
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

        sorted_results = sorted(self.results, key=sort_key)

        for i, result in enumerate(sorted_results):
            # Format ebook status
            if result.ebook:
                ebook_text, _ = format_availability(
                    result.ebook.status,
                    result.ebook.wait_days,
                    result.ebook.holds_count
                )
            else:
                ebook_text = "—"

            # Format audiobook status
            if result.audiobook:
                audiobook_text, _ = format_availability(
                    result.audiobook.status,
                    result.audiobook.wait_days,
                    result.audiobook.holds_count
                )
            else:
                audiobook_text = "—"

            # Get cache age
            key = f"{result.title}|{result.author}"
            updated = self.cache_ages.get(key, "")

            # Determine row tag based on best availability
            tag = "not_found"
            if result.ebook and result.ebook.status == AvailabilityStatus.AVAILABLE:
                tag = "available"
            elif result.audiobook and result.audiobook.status == AvailabilityStatus.AVAILABLE:
                tag = "available"
            elif result.ebook and result.ebook.status == AvailabilityStatus.WAITLIST:
                if result.ebook.wait_days and result.ebook.wait_days > 30:
                    tag = "waitlist_long"
                else:
                    tag = "waitlist"
            elif result.audiobook and result.audiobook.status == AvailabilityStatus.WAITLIST:
                if result.audiobook.wait_days and result.audiobook.wait_days > 30:
                    tag = "waitlist_long"
                else:
                    tag = "waitlist"

            # Add alternating row background
            tags = (tag, "alt") if i % 2 == 1 else (tag,)

            self.tree.insert(
                "",
                tk.END,
                values=(result.title, result.author, ebook_text, audiobook_text, updated),
                tags=tags,
            )

    def run(self):
        """Show the window and start the event loop."""
        self.root.mainloop()


def show_results(results: List[LibbyResult], cache_ages: Optional[Dict[str, str]] = None):
    """Display results in a GUI window."""
    window = ResultsWindow(results, cache_ages)
    window.run()
