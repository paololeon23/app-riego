# -*- coding: utf-8 -*-
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
valv_js = (ROOT / "js" / "valvular-data.js").read_text(encoding="utf-8")
lotes = json.loads((ROOT / "data" / "lotes-licapa.json").read_text(encoding="utf-8"))

valv = re.findall(r'"(M\d+)\|T(\d+)":\s*(\d+)', valv_js)
by = defaultdict(list)
for m, t, v in valv:
    by[m].append((int(t), int(v)))

print("=== SELECTS (modulo -> turnos) ===")
for m in sorted(by, key=lambda x: int(x[1:])):
    turns = sorted(by[m])
    print(m + ":", ", ".join(f"T{t}" for t, _ in turns))

print()
print("=== Variedad por M|T en select ===")
idx = {(L["modulo"], str(L["turno"]), str(L["lote"])): L for L in lotes}
for m, t, v in sorted(valv, key=lambda x: (int(x[0][1:]), int(x[1]))):
    L = idx.get((m, t, str(v)))
    if L:
        print(f"{m}|T{t} valv{v} -> {L['variedad']} / {L['etapa']}")
    else:
        print(f"{m}|T{t} valv{v} -> SIN LOTE EN CAT")
