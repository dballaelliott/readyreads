"""Check whether OverDrive's Thunder API permits cross-origin browser calls."""

import requests

URL = "https://thunder.api.overdrive.com/v2/libraries/chipublib/media"
ORIGIN = "https://example.github.io"

print("== GET with Origin header ==")
r = requests.get(
    URL,
    params={"query": "dune", "perPage": 1},
    headers={"Origin": ORIGIN, "User-Agent": "Mozilla/5.0"},
    timeout=30,
)
print("status:", r.status_code)
for h in ("access-control-allow-origin", "access-control-allow-credentials", "vary"):
    print(f"{h}: {r.headers.get(h)!r}")

print("\n== OPTIONS preflight ==")
p = requests.options(
    URL,
    headers={
        "Origin": ORIGIN,
        "Access-Control-Request-Method": "GET",
        "User-Agent": "Mozilla/5.0",
    },
    timeout=30,
)
print("status:", p.status_code)
for h in ("access-control-allow-origin", "access-control-allow-methods", "access-control-allow-headers"):
    print(f"{h}: {p.headers.get(h)!r}")
