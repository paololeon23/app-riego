# -*- coding: utf-8 -*-
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
lotes = json.loads((ROOT / "data" / "lotes-licapa.json").read_text(encoding="utf-8"))
valv_js = (ROOT / "js" / "valvular-data.js").read_text(encoding="utf-8")
gas = (ROOT / "gas" / "Code.gs").read_text(encoding="utf-8")

# Referencia de las fotos del usuario
REF = {
    # Sekoya Pop = Licapa I
    ("M1", "1"): "Sekoya Pop",
    ("M1", "3"): "Sekoya Pop",
    ("M1", "5"): "Sekoya Pop",
    ("M1", "7"): "Sekoya Pop",
    ("M1", "9"): "Sekoya Pop",
    ("M2", "2"): "Sekoya Pop",
    ("M2", "4"): "Sekoya Pop",
    ("M2", "6"): "Sekoya Pop",
    ("M2", "8"): "Sekoya Pop",
    ("M2", "10"): "Sekoya Pop",
    ("M3", "1"): "Sekoya Pop",
    ("M3", "3"): "Sekoya Pop",
    ("M3", "5"): "Sekoya Pop",
    ("M3", "7"): "Sekoya Pop",
    ("M3", "9"): "Sekoya Pop",
    ("M4", "2"): "Sekoya Pop",
    ("M4", "4"): "Sekoya Pop",
    ("M4", "6"): "Sekoya Pop",
    ("M4", "8"): "Sekoya Pop",
    ("M4", "10"): "Sekoya Pop",
    ("M5", "1"): "Sekoya Pop",
    ("M5", "3"): "Sekoya Pop",
    ("M5", "9"): "Sekoya Pop",
    ("M6", "2"): "Sekoya Pop",
    ("M6", "4"): "Sekoya Pop",
    ("M10", "5"): "Sekoya Pop",
    ("M10", "6"): "Sekoya Pop",
    ("M10", "7"): "Sekoya Pop",
    ("M10", "11"): "Sekoya Pop",
    # Magica = Licapa II
    ("M6", "8"): "Mágica",
    ("M6", "10"): "Mágica",
    ("M7", "1"): "Mágica",
    ("M7", "3"): "Mágica",
    ("M7", "5"): "Mágica",
    ("M7", "7"): "Mágica",
    ("M7", "9"): "Mágica",
    ("M8", "2"): "Mágica",
    ("M8", "4"): "Mágica",
    ("M8", "6"): "Mágica",
    ("M8", "8"): "Mágica",
    ("M8", "10"): "Mágica",
    ("M9", "1"): "Mágica",
    ("M9", "3"): "Mágica",
    ("M9", "5"): "Mágica",
    ("M9", "7"): "Mágica",
    ("M9", "9"): "Mágica",
    ("M10", "8"): "Mágica",
    ("M10", "10"): "Mágica",
}

# Catalog index
cat = defaultdict(lambda: defaultdict(set))
for l in lotes:
    cat[(l["modulo"], str(l["turno"]))][l.get("variedad", "")].add(l.get("etapa", ""))

# Valvular keys
valv_keys = set(re.findall(r'"(M\d+)\|T(\d+)"', valv_js))
valv_keys |= set(re.findall(r"'(M\d+)\|T(\d+)'", gas))
valv = {(m, t) for m, t in valv_keys}

print("=== CATALOGO vs FOTO ===")
missing_cat = []
wrong_cat = []
for (mod, tur), want in sorted(REF.items(), key=lambda x: (x[0][0], int(x[0][1]))):
    have = cat.get((mod, tur), {})
    if not have:
        missing_cat.append((mod, tur, want))
        print(f"FALTA CAT  {mod} T{tur} -> deberia {want}")
        continue
    vars_ = set(have.keys())
    # normalize Magica accents
    ok = any(
        (want == "Sekoya Pop" and ("Sekoya Pop" in v or "S. Pop" in v))
        or (want == "Mágica" and ("Mágica" in v or "Magica" in v or "MAGICA" in v.upper()))
        for v in vars_
    )
    if not ok:
        wrong_cat.append((mod, tur, want, vars_))
        print(f"MAL CAT    {mod} T{tur} -> tiene {vars_} | foto {want}")
    else:
        extra = vars_ - {"Sekoya Pop", "Mágica", "S. Pop"}
        if len(vars_) > 1:
            print(f"MIXTO CAT  {mod} T{tur} -> {vars_} (foto {want})")

print("\n=== VALVULAR vs FOTO ===")
missing_valv = []
for (mod, tur), want in sorted(REF.items(), key=lambda x: (x[0][0], int(x[0][1]))):
    if (mod, tur) not in valv:
        # M5 has only some turnos in valv - still report
        missing_valv.append((mod, tur, want))
        print(f"FALTA VALV {mod} T{tur} -> {want}")

print("\n=== VALVULAR extra (no en foto, ok si hay lotes) ===")
for mod, tur in sorted(valv, key=lambda x: (x[0], int(x[1]))):
    if (mod, tur) not in REF:
        have = cat.get((mod, tur), {})
        print(f"EXTRA VALV {mod} T{tur} cat={dict(have) and list(have.keys())}")

print("\n=== RESUMEN ===")
print("faltan catalogo:", len(missing_cat))
print("mal variedad:", len(wrong_cat))
print("faltan valvular:", len(missing_valv))
print("keys valvular:", len(valv))
print("lotes total:", len(lotes))
