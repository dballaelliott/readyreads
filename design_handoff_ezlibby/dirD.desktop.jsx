// Direction D — "Friendly & Plain"
// All sans-serif (Figtree). Blues + greens. No horizontal rules anywhere —
// rhythm comes from whitespace alone. Rating is a plain number with the
// review count beneath it, both width-matched. Simpler, simpler, simpler.

function DirD() {
  const B = window.EZ_BOOKS, C = window.EZ_COUNTS;
  const c = {
    bg: '#EEF5F3', card: '#FFFFFF', ink: '#163A38', soft: '#5E7C7B', faint: '#9DB3B2',
    green: '#118A5C', greenBg: '#E0F2E8', blue: '#2D6FD6', blueBg: '#E6EFFB', slateBg: '#E7EEEC',
    sans: '"Figtree", system-ui, sans-serif',
  };

  const Avail = ({ kind, val }) => {
    if (val === 'now') return <span style={{ fontFamily: c.sans, fontSize: 13.5, fontWeight: 700, color: c.green, whiteSpace: 'nowrap' }}>{kind}</span>;
    const w = String(val).replace('~', '');
    return <span style={{ fontFamily: c.sans, fontSize: 13.5, fontWeight: 500, color: c.faint, whiteSpace: 'nowrap' }}>{kind} ({w})</span>;
  };

  const Rating = ({ r, reviews }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, lineHeight: 1 }}>
      <span style={{ fontFamily: c.sans, fontSize: 29, fontWeight: 700, color: c.ink, letterSpacing: '-.01em' }}>{r.toFixed(1)}</span>
      <span style={{ fontFamily: c.sans, fontSize: 14, fontWeight: 600, color: c.faint, marginTop: 4 }}>{reviews}</span>
    </div>
  );

  const Row = ({ b }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, padding: '15px 0' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <a style={{ fontFamily: c.sans, fontSize: 19, fontWeight: 600, color: c.ink, lineHeight: 1.25, textDecoration: 'none', cursor: 'pointer' }}>{b.title}</a>
        <div style={{ fontFamily: c.sans, fontSize: 14, fontWeight: 500, color: c.soft, marginTop: 3 }}>by {b.author}</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 11 }}>
          <Avail kind="ebook" val={b.ebook} />
          <Avail kind="audio" val={b.audio} />
        </div>
      </div>
      <Rating r={b.rating} reviews={b.reviews} />
    </div>
  );

  const Group = ({ title, books }) => (
    <div style={{ marginTop: 34 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ fontFamily: c.sans, fontSize: 23, fontWeight: 700, color: c.ink, margin: 0, letterSpacing: '-.01em' }}>{title}</h2>
        <span style={{ fontFamily: c.sans, fontSize: 13, fontWeight: 600, color: c.soft, background: c.slateBg, padding: '3px 9px', borderRadius: 999 }}>{books.length}</span>
      </div>
      <div style={{ marginTop: 6 }}>{books.map((b, i) => <Row key={i} b={b} />)}</div>
    </div>
  );

  return (
    <div style={{ background: c.bg, minHeight: '100%', padding: '24px 24px 36px', boxSizing: 'border-box', color: c.ink }}>
      {/* Masthead + controls on one soft card */}
      <div style={{ background: c.card, borderRadius: 22, padding: '26px 26px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: c.sans, fontSize: 11, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: c.faint }}>Public Library Companion</div>
            <div style={{ fontFamily: c.sans, fontSize: 46, fontWeight: 800, letterSpacing: '-.035em', lineHeight: 1, margin: '8px 0 8px', color: c.ink }}>ezlibby</div>
            <div style={{ fontFamily: c.sans, fontSize: 15.5, fontWeight: 500, color: c.soft, maxWidth: 330, lineHeight: 1.4 }}>your want-to-read list, sorted by what you can borrow now</div>
          </div>
          <span style={{ fontFamily: c.sans, fontSize: 12.5, fontWeight: 600, color: c.green, background: c.greenBg, padding: '6px 12px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.green, display: 'inline-block' }} /> synced
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
          <input placeholder="Library identifier" defaultValue="lapl" style={{ fontFamily: c.sans, fontSize: 14, fontWeight: 500, padding: '11px 15px', borderRadius: 12, border: 'none', background: c.bg, color: c.ink, width: 140 }} />
          <button style={{ flex: 1, minWidth: 150, fontFamily: c.sans, fontSize: 14, fontWeight: 600, padding: '11px 15px', borderRadius: 12, border: 'none', background: c.bg, color: c.soft, cursor: 'pointer', textAlign: 'left' }}>↑ Import CSV or paste a link</button>
          <button style={{ whiteSpace: 'nowrap', fontFamily: c.sans, fontSize: 14, fontWeight: 700, padding: '11px 18px', borderRadius: 12, border: 'none', background: c.blue, color: '#fff', cursor: 'pointer' }}>↻ Refresh all</button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, margin: '20px 6px 0' }}>
        <span style={{ whiteSpace: 'nowrap', fontFamily: c.sans, fontSize: 17, fontWeight: 600, color: c.ink }}><span style={{ color: c.green }}>{C.available} available now</span> <span style={{ color: c.faint, fontWeight: 500 }}>· {C.total} titles</span></span>
        <span style={{ whiteSpace: 'nowrap', fontFamily: c.sans, fontSize: 13, fontWeight: 600, color: c.faint, cursor: 'pointer' }}>▸ Settings</span>
      </div>

      <div style={{ padding: '0 6px' }}>
        <Group title="Ready to read" books={B.ready} />
        <Group title="Listen instead" books={B.listen} />
        <Group title="Worth the wait" books={B.wait} />

        <details style={{ marginTop: 30, fontFamily: c.sans, fontSize: 14, fontWeight: 500, color: c.soft }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Failed to match ({B.failed.length})</summary>
          <div style={{ marginTop: 10 }}>
            {B.failed.map((b, i) => <div key={i} style={{ padding: '5px 0' }}>{b.title}</div>)}
          </div>
        </details>
      </div>

      <div style={{ fontFamily: c.sans, fontSize: 12.5, fontWeight: 500, color: c.faint, textAlign: 'center', marginTop: 32 }}>Everything runs in your browser. Nothing leaves this page.</div>
    </div>
  );
}

window.DirD = DirD;
