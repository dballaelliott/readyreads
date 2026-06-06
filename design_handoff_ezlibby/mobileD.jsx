// ezlibby — mobile (Direction D), interactive.
// One phone screen that cycles empty → loading → populated each time the
// refresh / primary button is tapped. All sans (Figtree), blue + green,
// near-white background, bigger type, no horizontal rules.

const { useState, useEffect, useRef } = React;

const D = {
  bg: '#F7FBFA', ink: '#163A38', soft: '#5E7C7B', faint: '#A6BAB8',
  fill: '#ECF3F1', green: '#0F9460', blue: '#2D6FD6',
  sans: '"Figtree", system-ui, sans-serif',
};

function Avail({ kind, val }) {
  if (val === 'now') return <span style={{ fontFamily: D.sans, fontSize: 15, fontWeight: 700, color: D.green, whiteSpace: 'nowrap' }}>{kind}</span>;
  const w = String(val).replace('~', '');
  return <span style={{ fontFamily: D.sans, fontSize: 15, fontWeight: 500, color: D.faint, whiteSpace: 'nowrap' }}>{kind} ({w})</span>;
}

function Rating({ r, reviews }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, lineHeight: 1 }}>
      <span style={{ fontFamily: D.sans, fontSize: 34, fontWeight: 800, color: D.ink, letterSpacing: '-.02em' }}>{r.toFixed(1)}</span>
      <span style={{ fontFamily: D.sans, fontSize: 16, fontWeight: 600, color: D.faint, marginTop: 5 }}>{reviews}</span>
    </div>
  );
}

function BookRow({ b }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, padding: '17px 0' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <a style={{ fontFamily: D.sans, fontSize: 23, fontWeight: 700, color: D.ink, lineHeight: 1.22, textDecoration: 'none', letterSpacing: '-.01em', display: 'block' }}>{b.title}</a>
        <div style={{ fontFamily: D.sans, fontSize: 16, fontWeight: 500, color: D.soft, marginTop: 4 }}>by {b.author}</div>
        <div style={{ display: 'flex', gap: 18, marginTop: 12 }}>
          <Avail kind="ebook" val={b.ebook} />
          <Avail kind="audio" val={b.audio} />
        </div>
      </div>
      <Rating r={b.rating} reviews={b.reviews} />
    </div>
  );
}

function Group({ title, books }) {
  return (
    <div style={{ marginTop: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <h2 style={{ fontFamily: D.sans, fontSize: 30, fontWeight: 800, color: D.ink, margin: 0, letterSpacing: '-.02em', whiteSpace: 'nowrap' }}>{title}</h2>
        <span style={{ fontFamily: D.sans, fontSize: 15, fontWeight: 700, color: D.soft, background: D.fill, padding: '3px 11px', borderRadius: 999 }}>{books.length}</span>
      </div>
      <div style={{ marginTop: 4 }}>{books.map((b, i) => <BookRow key={i} b={b} />)}</div>
    </div>
  );
}

function SkeletonRow({ w }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, padding: '17px 0', opacity: .7 }}>
      <div style={{ flex: 1 }}>
        <div style={{ height: 17, width: w, background: D.fill, borderRadius: 6 }} />
        <div style={{ height: 13, width: '38%', background: D.fill, borderRadius: 6, marginTop: 11 }} />
      </div>
      <div style={{ fontFamily: D.sans, fontSize: 14, fontWeight: 600, color: D.faint }}>checking…</div>
    </div>
  );
}

function App() {
  const STATES = ['empty', 'loading', 'populated'];
  const [si, setSi] = useState(() => {
    const h = (location.hash || '').replace('#', '');
    const hi = STATES.indexOf(h);
    if (hi >= 0) return hi;
    const v = parseInt(localStorage.getItem('ezd-state'), 10);
    return Number.isFinite(v) && v >= 0 && v < 3 ? v : 0;
  });
  const state = STATES[si];
  useEffect(() => { localStorage.setItem('ezd-state', String(si)); }, [si]);
  const next = () => setSi((s) => (s + 1) % 3);

  // animate the "checking n/87" counter while loading
  const [n, setN] = useState(58);
  const timer = useRef(null);
  useEffect(() => {
    clearInterval(timer.current);
    if (state === 'loading') {
      setN(34);
      timer.current = setInterval(() => setN((x) => (x >= 61 ? 61 : x + 1)), 55);
    }
    return () => clearInterval(timer.current);
  }, [state]);

  const B = window.EZ_BOOKS, C = window.EZ_COUNTS;

  return (
    <div style={{ background: D.bg, minHeight: '100%', color: D.ink, fontFamily: D.sans }}>
      {/* status bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px 0', fontFamily: D.sans, fontSize: 14, fontWeight: 700, color: D.ink }}>
        <span>9:41</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: D.soft, letterSpacing: '.04em' }}>wi-fi · 84%</span>
      </div>

      <div style={{ padding: '16px 24px 40px' }}>
        {/* Masthead */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: D.faint }}>Public Library Companion</div>
            <div style={{ fontSize: 58, fontWeight: 800, letterSpacing: '-.04em', lineHeight: .95, margin: '10px 0 10px' }}>ezlibby</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: D.soft, lineHeight: 1.4 }}>your want-to-read list, sorted by what you can borrow now</div>
          </div>
        </div>

        {/* EMPTY */}
        {state === 'empty' && (
          <React.Fragment>
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input placeholder="Library identifier" defaultValue="lapl" style={{ fontFamily: D.sans, fontSize: 16, fontWeight: 500, padding: '15px 17px', borderRadius: 14, border: 'none', background: D.fill, color: D.ink }} />
              <button style={{ width: '100%', fontFamily: D.sans, fontSize: 16, fontWeight: 600, padding: '16px', borderRadius: 14, border: 'none', background: D.fill, color: D.soft, cursor: 'pointer', textAlign: 'left' }}>↑ Import a Goodreads CSV or paste a link</button>
            </div>
            <div style={{ marginTop: 34, textAlign: 'center', padding: '8px 0 4px' }}>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 10 }}>Let's find your next read.</div>
              <div style={{ fontSize: 17, fontWeight: 500, color: D.soft, lineHeight: 1.5, maxWidth: 320, margin: '0 auto' }}>Add your want-to-read list and we'll show you what's borrowable right now.</div>
            </div>
            <button onClick={next} style={primaryBtn(D.blue)}>↻ Check availability</button>
            <Hint>tap to see it check your list</Hint>
          </React.Fragment>
        )}

        {/* LOADING */}
        {state === 'loading' && (
          <React.Fragment>
            <CompactControls onRefresh={next} spinning />
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 17, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Spinner /> Checking {n} / {C.total}…
                </span>
                <span style={{ fontSize: 16, fontWeight: 700, color: D.green }}>3 found</span>
              </div>
              <div style={{ height: 7, background: D.fill, borderRadius: 99, marginTop: 14, overflow: 'hidden' }}>
                <div style={{ width: `${(n / C.total) * 100}%`, height: '100%', background: D.blue, borderRadius: 99, transition: 'width .2s' }} />
              </div>
            </div>
            <div style={{ marginTop: 34 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em', margin: 0, whiteSpace: 'nowrap' }}>Ready to read</h2>
              </div>
              <div style={{ marginTop: 4 }}>
                {B.ready.slice(0, 2).map((b, i) => <BookRow key={i} b={b} />)}
                <SkeletonRow w="64%" />
                <SkeletonRow w="48%" />
              </div>
            </div>
            <Hint>tap ↻ to finish — results stream in live</Hint>
          </React.Fragment>
        )}

        {/* POPULATED */}
        {state === 'populated' && (
          <React.Fragment>
            <CompactControls onRefresh={next} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 22 }}>
              <span style={{ whiteSpace: 'nowrap', fontSize: 19, fontWeight: 700 }}><span style={{ color: D.green }}>{C.available} available now</span> <span style={{ color: D.faint, fontWeight: 500 }}>· {C.total} titles</span></span>
              <span style={{ whiteSpace: 'nowrap', fontSize: 14, fontWeight: 600, color: D.faint }}>▸ Settings</span>
            </div>
            <Group title="Ready to read" books={B.ready} />
            <Group title="Listen instead" books={B.listen} />
            <Group title="Worth the wait" books={B.wait} />
            <details style={{ marginTop: 32, fontSize: 15, fontWeight: 500, color: D.soft }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Failed to match ({B.failed.length})</summary>
              <div style={{ marginTop: 12 }}>
                {B.failed.map((b, i) => <div key={i} style={{ padding: '6px 0' }}>{b.title}</div>)}
              </div>
            </details>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: D.faint, textAlign: 'center', marginTop: 34, lineHeight: 1.5 }}>Everything runs in your browser.<br/>Nothing leaves this page.</div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

function primaryBtn(bg) {
  return { width: '100%', marginTop: 30, fontFamily: D.sans, fontSize: 18, fontWeight: 700, padding: '17px', borderRadius: 14, border: 'none', background: bg, color: '#fff', cursor: 'pointer' };
}

function Hint({ children }) {
  return <div style={{ textAlign: 'center', marginTop: 14, fontFamily: D.sans, fontSize: 13.5, fontWeight: 600, color: D.faint }}>{children}</div>;
}

function Spinner() {
  return <span style={{ display: 'inline-block', width: 16, height: 16, border: `2.5px solid ${D.fill}`, borderTopColor: D.blue, borderRadius: '50%', animation: 'ezspin .7s linear infinite' }} />;
}

function CompactControls({ onRefresh, spinning }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
      <input defaultValue="lapl" style={{ flex: 1, minWidth: 0, fontFamily: D.sans, fontSize: 16, fontWeight: 500, padding: '13px 16px', borderRadius: 13, border: 'none', background: D.fill, color: D.ink }} />
      <button onClick={onRefresh} style={{ flexShrink: 0, fontFamily: D.sans, fontSize: 16, fontWeight: 700, padding: '0 22px', borderRadius: 13, border: 'none', background: D.blue, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-block', animation: spinning ? 'ezspin .7s linear infinite' : 'none' }}>↻</span> Refresh
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
