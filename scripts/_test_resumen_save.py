# -*- coding: utf-8 -*-
"""Simula resumen → filas → clasificación hoja (LICAPA / LICAPA II)."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
lotes = json.loads((ROOT / "data" / "lotes-licapa.json").read_text(encoding="utf-8"))
valv = (ROOT / "js" / "valvular-data.js").read_text(encoding="utf-8")
gas = (ROOT / "gas" / "Code.gs").read_text(encoding="utf-8")

BY = {f"{m}|T{t}": int(v) for m, t, v in re.findall(r'"(M\d+)\|T(\d+)":\s*(\d+)', valv)}
VAR = {
    f"{m}|T{t}": v
    for m, t, v in re.findall(r'"(M\d+)\|T(\d+)":\s*"(SEKOYA POP|MAGICA)"', valv)
}

assert 'SHEET_LICAPA_I = \'LICAPA\'' in gas or 'SHEET_LICAPA_I = "LICAPA"' in gas
assert 'SHEET_LICAPA_II = \'LICAPA II\'' in gas or 'SHEET_LICAPA_II = "LICAPA II"' in gas
assert "r.fundo = 'LICAPA'" in gas or 'fundo: \'LICAPA\'' in gas
assert "LICAPA II" in gas

# Index lotes by mod|turno|lote
idx = {}
for L in lotes:
    idx[(L["modulo"], str(L["turno"]), str(L["lote"]))] = L


def map_var(v):
    u = (
        str(v or "")
        .upper()
        .replace("Á", "A")
        .replace("É", "E")
        .replace("Í", "I")
        .replace("Ó", "O")
        .replace("Ú", "U")
    )
    if "POP" in u:
        return "SEKOYA POP"
    if "MAG" in u:
        return "MAGICA"
    return u


def etapa_kind(e):
    e = str(e or "").upper()
    if "II" in e:
        return "II"
    if "I" in e or "LICAPA" in e:
        return "I"
    return ""


def build_row(modulo, turno, lote_n, aforo, b1, b2):
    key = f"{modulo}|T{turno}"
    assert key in BY, f"falta valvular {key}"
    L = idx.get((modulo, str(turno), str(lote_n)))
    var = map_var(L["variedad"] if L else VAR.get(key, ""))
    kind = etapa_kind(L["etapa"]) if L else ("" if "MAG" in var else "I")
    if kind == "I" or "POP" in var:
        fundo = "LICAPA"
        var = var or "SEKOYA POP"
    elif kind == "II" or "MAG" in var:
        fundo = "LICAPA II"
        var = var or "MAGICA"
    else:
        fundo = ""
    pct = round((((b1 + b2) / 2) / aforo) * 100) if aforo else 0
    assert aforo > b1 and aforo > b2, "SFR debe ser > B1 y > B2"
    sheet = "LICAPA II" if "II" in fundo else "LICAPA"
    return {
        "modulo": modulo,
        "turno": turno,
        "lote": lote_n,
        "fundo": fundo,
        "variedad": var,
        "valvular": int(BY[key]),
        "aforo": aforo,
        "drenaje1": b1,
        "drenaje2": b2,
        "pctReal": pct,
        "sheet": sheet,
        "form": f"T{turno} - {modulo}",
    }


# Casos reales M6 + M10 + típicos
CASES = [
    ("M6", 2, 249, 4000, 900, 950),   # Sekoya → LICAPA
    ("M6", 4, 251, 3800, 800, 850),   # Sekoya → LICAPA
    ("M6", 8, 260, 4200, 1000, 1100), # Magica → LICAPA II
    ("M6", 10, 271, 4100, 900, 1000), # Magica → LICAPA II
    ("M1", 1, 4, 5000, 1200, 1300),   # Sekoya → LICAPA
    ("M7", 1, 283, 3900, 700, 800),   # Magica → LICAPA II
    ("M10", 5, 200, 3600, 600, 700),  # Sekoya → LICAPA
    ("M10", 8, 216, 3700, 650, 750),  # Magica → LICAPA II
]

rows = []
errors = []
for c in CASES:
    try:
        r = build_row(*c)
        rows.append(r)
        expect_var = VAR.get(f"{c[0]}|T{c[1]}", "")
        if expect_var and r["variedad"] != expect_var:
            errors.append(f"var {c}: got {r['variedad']} want {expect_var}")
        if expect_var == "SEKOYA POP" and r["sheet"] != "LICAPA":
            errors.append(f"sheet {c}: {r['sheet']}")
        if expect_var == "MAGICA" and r["sheet"] != "LICAPA II":
            errors.append(f"sheet {c}: {r['sheet']}")
        if r["fundo"] not in ("LICAPA", "LICAPA II"):
            errors.append(f"fundo bad {c}: {r['fundo']}")
        if r["fundo"] == "LICAPA I":
            errors.append(f"legado LICAPA I en {c}")
    except Exception as ex:
        errors.append(f"{c}: {ex}")

# Simular payload resumen / save
payload = {
    "type": "aforos",
    "clientId": "test-client-uuid-001",
    "data": {
        "fecha": "2026-11-06",
        "evaluador": "41613772 — VIGO VILLANUEVA MIGUEL",
        "eto": 4.2,
        "ubicacion": "MEDIO",
        "aforo_rows": rows,
        "turnos": [
            {
                "modulo": r["modulo"],
                "turno": str(r["turno"]),
                "lote": str(r["lote"]),
                "valvula": str(r["valvular"]),
                "aforo": str(r["aforo"]),
                "drenaje1": str(r["drenaje1"]),
                "drenaje2": str(r["drenaje2"]),
            }
            for r in rows
        ],
    },
    "score": {
        "calidadGlobal": f"{len(rows)} turnos",
        "rows": [{"item": r["form"], "pct": r["pctReal"]} for r in rows],
    },
}

# Partición como Code.gs
rows_i = [r for r in rows if r["sheet"] == "LICAPA"]
rows_ii = [r for r in rows if r["sheet"] == "LICAPA II"]

print("=== RESUMEN / GUARDAR (simulación) ===")
print("registros:", len(rows))
print("→ hoja LICAPA:", len(rows_i), [f"{r['modulo']}T{r['turno']}" for r in rows_i])
print("→ hoja LICAPA II:", len(rows_ii), [f"{r['modulo']}T{r['turno']}" for r in rows_ii])
print("clientId:", payload["clientId"])
print("score:", payload["score"]["calidadGlobal"])
for r in rows:
    print(
        f"  {r['modulo']} T{r['turno']} lote{r['lote']} "
        f"{r['variedad']} FUNDO={r['fundo']} → {r['sheet']} "
        f"SFR={r['aforo']} B1={r['drenaje1']} B2={r['drenaje2']} %{r['pctReal']}"
    )

# Checks código app save/resumen
app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
assert "fromResumen" in app, "falta protección save desde resumen"
assert "goResumen" in app
assert "aforo_rows" in app
assert "QB.API.submit" in app

api = (ROOT / "js" / "api.js").read_text(encoding="utf-8")
assert "rememberSentId_" in api
assert "wasAlreadySent_" in api
assert "duplicate" in api

print()
if errors:
    print("FAIL:")
    for e in errors:
        print(" ", e)
    raise SystemExit(1)
print("OK: resumen + filas + FUNDO + hojas + anti-dup código listos")
