// Shared sample data for all ezlibby design directions.
// A small, believable want-to-read list already sorted into tiers.

const EZ_BOOKS = {
  ready: [
    { title: 'Tomorrow, and Tomorrow, and Tomorrow', author: 'Gabrielle Zevin', rating: 4.2, reviews: '712k', ebook: 'now', audio: '~2w', updated: '2h ago' },
    { title: 'Piranesi', author: 'Susanna Clarke', rating: 4.3, reviews: '389k', ebook: 'now', audio: 'now', updated: '2h ago' },
    { title: 'The Overstory', author: 'Richard Powers', rating: 4.1, reviews: '421k', ebook: 'now', audio: '~4w', updated: '6h ago' },
  ],
  listen: [
    { title: 'Sea of Tranquility', author: 'Emily St. John Mandel', rating: 4.2, reviews: '298k', ebook: 'waitlist', audio: 'now', updated: '2h ago' },
    { title: 'Cloud Cuckoo Land', author: 'Anthony Doerr', rating: 4.0, reviews: '215k', ebook: '~5w', audio: 'now', updated: '1d ago' },
  ],
  wait: [
    { title: 'Demon Copperhead', author: 'Barbara Kingsolver', rating: 4.5, reviews: '487k', ebook: '~8w', audio: '~6w', updated: '3h ago' },
    { title: 'The Bee Sting', author: 'Paul Murray', rating: 4.3, reviews: '96k', ebook: '~10w', audio: '~9w', updated: '5h ago' },
    { title: 'Trust', author: 'Hernan Diaz', rating: 3.9, reviews: '143k', ebook: '~3w', audio: '~3w', updated: '1d ago' },
  ],
  failed: [
    { title: 'Untitled (ARC galley, 2026)', author: 'no library match', rating: null },
    { title: 'The Pocket Notebook — vol. 3', author: 'self-published', rating: null },
  ],
};

const EZ_COUNTS = { available: 5, total: 87, checked: 87 };

Object.assign(window, { EZ_BOOKS, EZ_COUNTS });
