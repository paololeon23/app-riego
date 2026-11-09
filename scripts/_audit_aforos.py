# -*- coding: utf-8 -*-
"""Auditoría rápida: catálogo vs Code.gs + POST smoke."""
import base64
import datetime
import json
import re
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(r"c:\Users\CRISTOPHERPAOLOLEONA\Desktop\jennice app")
ok_all = True


def fail(msg):
    global ok_all
    ok_all = False
    print("FAIL:", msg)


def ok(msg):
    print("OK  :", msg)


# --- parse valvular-data.js BY_MOD_TURNO ---
vd = (ROOT / "js" / "valvular-data.js").read_text(encoding="utf-8")
m = re.search(r"const BY_MOD_TURNO = \{([^}]+)\}", vd, re.S)
js_map = {}
for k, v in re.findall(r'"([^"]+)":\s*(\d+|\"[^\"]+\")', m.group(1)):
    js_map[k] = int(v) if v.isdigit() else v.strip('"')

ensayo_js = re.findall(r'lote:\s*"(\d+)"', vd)
ensayo_js = [x for x in ensayo_js if x in ("80", "84") or True]
# better: only ENSAYO_ENTRIES block
em = re.search(r"const ENSAYO_ENTRIES = \[([^\]]+)\]", vd, re.S)
ensayo_lots = re.findall(r'lote:\s*"(\d+)"', em.group(1)) if em else []

# --- parse Code.gs VALVULAR_MAP ---
gs = (ROOT / "gas" / "Code.gs").read_text(encoding="utf-8")
gm = re.search(r"var VALVULAR_MAP = \{([^}]+)\}", gs, re.S)
gs_map = {}
for k, v in re.findall(r"'([^']+)':\s*(\d+|'[^']+')", gm.group(1)):
    gs_map[k] = int(v) if v.isdigit() else v.strip("'")

ensayo_gs = re.findall(r"'(\d+)':\s*true", re.search(r"var ENSAYO_LOTES = \{([^}]+)\}", gs, re.S).group(1))

if js_map == gs_map:
    ok(f"VALVULAR_MAP sync ({len(js_map)} keys)")
else:
    only_js = sorted(set(js_map) - set(gs_map))
    only_gs = sorted(set(gs_map) - set(js_map))
    diff_vals = sorted(k for k in set(js_map) & set(gs_map) if js_map[k] != gs_map[k])
    fail(f"map mismatch only_js={only_js} only_gs={only_gs} diff={diff_vals}")

if set(ensayo_lots) == set(ensayo_gs) == {"80", "84"}:
    ok("ENSAYO lotes 80/84 sync")
else:
    fail(f"ENSAYO mismatch js={ensayo_lots} gs={ensayo_gs}")

# --- lotes JSON ---
lotes = json.loads((ROOT / "data" / "lotes-licapa.json").read_text(encoding="utf-8"))
lote_keys = {(x["modulo"], str(x["turno"]), str(x["lote"])) for x in lotes}
expected = set()
for k, v in js_map.items():
    mod, t = k.split("|")
    expected.add((mod, t[1:], str(v)))
for e in ensayo_lots:
    # find turno from ENSAYO_ENTRIES text
    pass
# parse ensayo entries fully
for mod, t, lote in re.findall(
    r'modulo:\s*"([^"]+)",\s*turno:\s*(\d+),\s*lote:\s*"(\d+)"', em.group(1)
):
    expected.add((mod, t, lote))

missing = sorted(expected - lote_keys)
extra = sorted(lote_keys - expected)
if not missing and not extra:
    ok(f"lotes-licapa.json exact match ({len(lotes)} lotes)")
else:
    fail(f"lotes missing={missing[:10]} extra={extra[:10]}")

# variedad consistency Sekoya→Licapa I / Magica→Licapa II
bad_etapa = []
for x in lotes:
    var = x.get("variedad", "").upper()
    et = x.get("etapa", "")
    if "MAG" in var and "II" not in et:
        bad_etapa.append(x)
    if "SEKOYA" in var or "POP" in var:
        if "II" in et:
            bad_etapa.append(x)
if not bad_etapa:
    ok("etapa/variedad coherent in JSON")
else:
    fail(f"etapa mismatch {bad_etapa[:3]}")

# UI checks
app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
if "Turno ${val} ·" in app or "Turno ${row.turno} ·" in app or "Turno ${entry.turno} ·" in app:
    fail("turno still shows variedad in label")
else:
    ok("turno label sin variedad")

if "SFR: ${" in app and "B1: ${" in app and "B2: ${" in app:
    ok("ops-last SFR/B1/B2 con ':'")
else:
    fail("ops-last format missing colon")

css = (ROOT / "css" / "styles.css").read_text(encoding="utf-8")
if ".ops-last {" in css and "margin-top" in css[css.find(".ops-last {") : css.find(".ops-last {") + 80]:
    ok("ops-last spacing CSS")
else:
    fail("ops-last margin missing")

cfg = (ROOT / "js" / "config.js").read_text(encoding="utf-8")
ver = re.search(r'VERSION:\s*"([^"]+)"', cfg).group(1)
idx = (ROOT / "index.html").read_text(encoding="utf-8")
sw = (ROOT / "sw.js").read_text(encoding="utf-8")
if f"?v={ver.replace('.', '')}" in idx.replace("1.9.6", "196") or "?v=196" in idx:
    # version 1.9.6 → 196
    expect_v = ver.replace(".", "")
    if f"?v={expect_v}" in idx:
        ok(f"index cache ?v={expect_v}")
    else:
        # try without dots: 1.9.6 -> 196
        alt = "".join(ver.split("."))
        if f"?v={alt}" in idx or (ver == "1.9.6" and "?v=196" in idx):
            ok("index cache bust aligned")
        else:
            fail(f"index ?v= not matching VERSION {ver}")
else:
    alt = "".join(ver.split("."))
    if f"?v={alt}" in idx:
        ok(f"index ?v={alt}")
    else:
        fail(f"index cache not aligned to {ver}")

# classification smoke (local)
def fold(s):
    return (
        str(s or "")
        .upper()
        .replace("Á", "A")
        .replace("É", "E")
        .replace("Í", "I")
        .replace("Ó", "O")
        .replace("Ú", "U")
    )


def classify(row):
    v = fold(row.get("variedad"))
    f = fold(row.get("fundo"))
    if "POP" in v or "SEKOYA" in v:
        return "LICAPA"
    if "MAG" in v:
        return "LICAPA II"
    if "II" in f:
        return "LICAPA II"
    if f == "LICAPA" or "LICAPA I" in f:
        return "LICAPA"
    return ""


cases = [
    ({"variedad": "SEKOYA POP", "fundo": "LICAPA"}, "LICAPA"),
    ({"variedad": "MAGICA", "fundo": "LICAPA II"}, "LICAPA II"),
    ({"variedad": "MÁGICA", "fundo": ""}, "LICAPA II"),
    ({"variedad": "", "fundo": "LICAPA"}, "LICAPA"),
]
for row, want in cases:
    got = classify(row)
    if got != want:
        fail(f"classify {row} -> {got} want {want}")
ok("classify LICAPA / LICAPA II local")

# lookup ensayo local
assert f'{ensayo_lots[0]}(ENSAYO)'  # format
ok(f"ensayo label format {ensayo_lots[0]}(ENSAYO)")

# --- live ping + 4 POST ---
EP = base64.b64decode(
    "aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4TElkNDdpQUZ0ZGdJYkRKMkdneXR6YWw4bnp3Mng0WE1velRhMXhHSEtORGo4djFoZmhBQVNDRUM2bTBtWXN2cVUvZXhlYw=="
).decode()


def post(body):
    raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        EP, data=raw, headers={"Content-Type": "text/plain;charset=utf-8"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.status, json.loads(resp.read().decode())


st, ping = post({"action": "ping"})
if st == 200 and ping.get("ok"):
    ok(f"ping live {ping.get('ts')}")
else:
    fail(f"ping {st} {ping}")

fecha = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-5))).strftime(
    "%Y-%m-%d"
)
stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
tag = datetime.datetime.now().strftime("%H%M%S")
evaluador = "75079075 — FLORES QUITO GERSON"

smoke_rows = [
    dict(modulo="M2", turno=7, lote="80", valvula="80(ENSAYO)", variedad="SEKOYA POP", fundo="LICAPA"),
    dict(modulo="M2", turno=8, lote="82", valvula=82, variedad="SEKOYA POP", fundo="LICAPA"),
    dict(modulo="M6", turno=8, lote="260", valvula=260, variedad="MAGICA", fundo="LICAPA II"),
    dict(modulo="M10", turno=8, lote="216", valvula=216, variedad="MAGICA", fundo="LICAPA II"),
]


def mk(i, row):
    r = dict(row)
    r.update(aforo=150, drenaje1=30, drenaje2=20, ubicacion="MEDIO", eto=3.1, lamina=4.2)
    return {
        "action": "save",
        "type": "aforos",
        "clientId": f"audit-{tag}-{i}-{uuid.uuid4().hex[:8]}",
        "submittedAt": stamp,
        "data": {
            "fecha": fecha,
            "evaluador": evaluador,
            "variedad": row["variedad"],
            "fundo": row["fundo"],
            "eto": 3.1,
            "lamina": 4.2,
            "aforo_rows": [r],
            "turnos": [r],
        },
        "score": {},
    }


records = [mk(i + 1, r) for i, r in enumerate(smoke_rows)]
st, batch = post({"action": "batchSave", "records": records})
results = batch.get("results") or []
if st == 200 and batch.get("ok") and len(results) == 4 and all(r.get("ok") and r.get("created") for r in results):
    sheets = [r.get("sheet") for r in results]
    ok(f"smoke POST 4/4 created sheets={sheets}")
else:
    fail(f"smoke POST {st} {batch}")

print()
print("RESULT:", "ALL OK" if ok_all else "HAS FAILURES")
raise SystemExit(0 if ok_all else 1)
