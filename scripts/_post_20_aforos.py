# -*- coding: utf-8 -*-
"""POST real: 10 LICAPA + 10 LICAPA II (incluye ENSAYO)."""
import base64
import datetime
import json
import time
import urllib.request
import uuid

EP = base64.b64decode(
    "aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4TElkNDdpQUZ0ZGdJYkRKMkdneXR6YWw4bnp3Mng0WE1velRhMXhHSEtORGo4djFoZmhBQVNDRUM2bTBtWXN2cVUvZXhlYw=="
).decode()

fecha = datetime.datetime.now(
    datetime.timezone(datetime.timedelta(hours=-5))
).strftime("%Y-%m-%d")
stamp = (
    datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
)
evaluador = "75079075 — FLORES QUITO GERSON"
tag = datetime.datetime.now().strftime("%H%M%S")

licapa = [
    dict(modulo="M1", turno=1, lote="4", valvula=4, variedad="SEKOYA POP", fundo="LICAPA"),
    dict(modulo="M1", turno=5, lote="21", valvula=21, variedad="SEKOYA POP", fundo="LICAPA"),
    dict(modulo="M2", turno=2, lote="55", valvula=55, variedad="SEKOYA POP", fundo="LICAPA"),
    dict(modulo="M2", turno=6, lote="74", valvula=74, variedad="SEKOYA POP", fundo="LICAPA"),
    dict(modulo="M2", turno=7, lote="80", valvula="80(ENSAYO)", variedad="SEKOYA POP", fundo="LICAPA"),
    dict(modulo="M2", turno=8, lote="82", valvula=82, variedad="SEKOYA POP", fundo="LICAPA"),
    dict(modulo="M2", turno=8, lote="84", valvula="84(ENSAYO)", variedad="SEKOYA POP", fundo="LICAPA"),
    dict(modulo="M3", turno=3, lote="105", valvula=105, variedad="SEKOYA POP", fundo="LICAPA"),
    dict(modulo="M5", turno=1, lote="184", valvula=184, variedad="SEKOYA POP", fundo="LICAPA"),
    dict(modulo="M10", turno=7, lote="202", valvula=202, variedad="SEKOYA POP", fundo="LICAPA"),
]

licapa2 = [
    dict(modulo="M6", turno=8, lote="260", valvula=260, variedad="MAGICA", fundo="LICAPA II"),
    dict(modulo="M6", turno=10, lote="271", valvula=271, variedad="MAGICA", fundo="LICAPA II"),
    dict(modulo="M7", turno=1, lote="283", valvula=283, variedad="MAGICA", fundo="LICAPA II"),
    dict(modulo="M7", turno=5, lote="301", valvula=301, variedad="MAGICA", fundo="LICAPA II"),
    dict(modulo="M7", turno=9, lote="318", valvula=318, variedad="MAGICA", fundo="LICAPA II"),
    dict(modulo="M8", turno=2, lote="330", valvula=330, variedad="MAGICA", fundo="LICAPA II"),
    dict(modulo="M8", turno=6, lote="349", valvula=349, variedad="MAGICA", fundo="LICAPA II"),
    dict(modulo="M9", turno=1, lote="374", valvula=374, variedad="MAGICA", fundo="LICAPA II"),
    dict(modulo="M9", turno=7, lote="405", valvula=405, variedad="MAGICA", fundo="LICAPA II"),
    dict(modulo="M10", turno=8, lote="216", valvula=216, variedad="MAGICA", fundo="LICAPA II"),
]


def mk_record(i, row):
    aforo = 120 + (i % 7) * 5
    b1 = 25 + (i % 5)
    b2 = 18 + (i % 4)
    assert aforo > b1 and aforo > b2
    r = dict(row)
    r.update(aforo=aforo, drenaje1=b1, drenaje2=b2, ubicacion="MEDIO", eto=3.2, lamina=4.5)
    return {
        "action": "save",
        "type": "aforos",
        "clientId": f"test-{tag}-{i:02d}-{uuid.uuid4().hex[:8]}",
        "submittedAt": stamp,
        "data": {
            "fecha": fecha,
            "evaluador": evaluador,
            "variedad": row["variedad"],
            "fundo": row["fundo"],
            "eto": 3.2,
            "lamina": 4.5,
            "aforo_rows": [r],
            "turnos": [r],
        },
        "score": {},
    }


records = [mk_record(i + 1, r) for i, r in enumerate(licapa)] + [
    mk_record(i + 11, r) for i, r in enumerate(licapa2)
]
assert len(records) == 20

all_results = []
for start in range(0, 20, 5):
    chunk = records[start : start + 5]
    body = {"action": "batchSave", "records": chunk}
    raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        EP,
        data=raw,
        headers={"Content-Type": "text/plain;charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            text = resp.read().decode("utf-8", errors="replace")
            data = json.loads(text)
            print(
                f"BATCH {start + 1}-{start + len(chunk)} "
                f"status={resp.status} ok={data.get('ok')} "
                f"n={len(data.get('results') or [])}"
            )
            for res in data.get("results") or []:
                all_results.append(res)
                print(" ", json.dumps(res, ensure_ascii=False))
    except Exception as e:
        print(f"BATCH {start + 1} FAIL {e}")
    time.sleep(1)

ok = sum(1 for r in all_results if r.get("ok"))
created = sum(1 for r in all_results if r.get("created"))
dup = sum(1 for r in all_results if r.get("duplicate"))
print("SUMMARY", {"total": len(all_results), "ok": ok, "created": created, "duplicate": dup})

for i, rec in enumerate(records):
    v = rec["data"]["aforo_rows"][0]["valvula"]
    sheet_hint = rec["data"]["fundo"]
    res = all_results[i] if i < len(all_results) else {}
    print(
        f"{i + 1:02d} {sheet_hint:10} L{rec['data']['aforo_rows'][0]['lote']:>4} "
        f"V={v!s:>12} -> ok={res.get('ok')} created={res.get('created')} "
        f"sheet={res.get('sheet')} err={res.get('error')}"
    )
