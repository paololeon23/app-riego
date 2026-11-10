/** Valvular por Módulo + Turno — lotes oficiales + ENSAYO (M2 T7/T8) */
window.QB = window.QB || {};

QB.VALVULAR = (() => {
  /** Clave M{n}|T{t} → N° válvula / lote normal (1:1) */
  const BY_MOD_TURNO = {
    "M1|T1": 4, "M1|T3": 11, "M1|T5": 21, "M1|T7": 31, "M1|T9": 41,
    "M2|T2": 55, "M2|T4": 65, "M2|T6": 74, "M2|T8": 82, "M2|T10": 92,
    "M3|T1": 97, "M3|T3": 105, "M3|T5": 111, "M3|T7": 120, "M3|T9": 130,
    "M4|T2": 144, "M4|T4": 152, "M4|T6": 163, "M4|T8": 170, "M4|T10": 177,
    "M5|T1": 184, "M5|T3": 192, "M5|T9": 219,
    /* M6: T2/T4 SEKOYA POP (LICAPA) · T8/T10 MAGICA (LICAPA II) */
    "M6|T2": 249, "M6|T4": 251, "M6|T8": 260, "M6|T10": 271,
    "M7|T1": 283, "M7|T3": 293, "M7|T5": 301, "M7|T7": 309, "M7|T9": 318,
    "M8|T2": 330, "M8|T4": 338, "M8|T6": 349, "M8|T8": 360, "M8|T10": 368,
    "M9|T1": 374, "M9|T3": 384, "M9|T5": 396, "M9|T7": 405, "M9|T9": 414,
    "M10|T7": 202, "M10|T8": 216, "M10|T11": 209,
  };

  /**
   * Lotes ENSAYO → válvula "80(ENSAYO)" / "84(ENSAYO)" en UI y Sheet.
   * M2 T7 L80 · M2 T8 L84 (además del L82 válvula normal en T8)
   */
  const ENSAYO_ENTRIES = [
    { modulo: "M2", turno: 7, lote: "80" },
    { modulo: "M2", turno: 8, lote: "84" },
  ];

  function ensayoLabel(lote) {
    const n = normLote(lote);
    return n && ENSAYO_ENTRIES.some((e) => e.lote === n) ? `${n}(ENSAYO)` : "";
  }

  const VARIEDAD_BY_MT = {
    "M1|T1": "SEKOYA POP", "M1|T3": "SEKOYA POP", "M1|T5": "SEKOYA POP", "M1|T7": "SEKOYA POP", "M1|T9": "SEKOYA POP",
    "M2|T2": "SEKOYA POP", "M2|T4": "SEKOYA POP", "M2|T6": "SEKOYA POP",
    "M2|T7": "SEKOYA POP", "M2|T8": "SEKOYA POP", "M2|T10": "SEKOYA POP",
    "M3|T1": "SEKOYA POP", "M3|T3": "SEKOYA POP", "M3|T5": "SEKOYA POP", "M3|T7": "SEKOYA POP", "M3|T9": "SEKOYA POP",
    "M4|T2": "SEKOYA POP", "M4|T4": "SEKOYA POP", "M4|T6": "SEKOYA POP", "M4|T8": "SEKOYA POP", "M4|T10": "SEKOYA POP",
    "M5|T1": "SEKOYA POP", "M5|T3": "SEKOYA POP", "M5|T9": "SEKOYA POP",
    "M6|T2": "SEKOYA POP", "M6|T4": "SEKOYA POP", "M6|T8": "MAGICA", "M6|T10": "MAGICA",
    "M7|T1": "MAGICA", "M7|T3": "MAGICA", "M7|T5": "MAGICA", "M7|T7": "MAGICA", "M7|T9": "MAGICA",
    "M8|T2": "MAGICA", "M8|T4": "MAGICA", "M8|T6": "MAGICA", "M8|T8": "MAGICA", "M8|T10": "MAGICA",
    "M9|T1": "MAGICA", "M9|T3": "MAGICA", "M9|T5": "MAGICA", "M9|T7": "MAGICA", "M9|T9": "MAGICA",
    "M10|T7": "SEKOYA POP", "M10|T8": "MAGICA", "M10|T11": "SEKOYA POP",
  };

  function normModulo(raw) {
    const s = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
    const m = s.match(/M?(\d{1,2})/);
    if (!m) return "";
    return `M${Number(m[1])}`;
  }

  function normTurno(raw) {
    const t = Number(String(raw || "").replace(/^T/i, "").trim());
    return Number.isFinite(t) && t > 0 ? t : 0;
  }

  function normLote(raw) {
    return String(raw || "").replace(/\D/g, "");
  }

  function mtKey(modulo, turno) {
    const mod = normModulo(modulo);
    const t = normTurno(turno);
    return mod && t ? `${mod}|T${t}` : "";
  }

  function variedadFor(modulo, turno) {
    const k = mtKey(modulo, turno);
    return k ? VARIEDAD_BY_MT[k] || "" : "";
  }

  function isEnsayoLote(lote) {
    const n = normLote(lote);
    return ENSAYO_ENTRIES.some((e) => e.lote === n);
  }

  function ensayoEntryFor(modulo, turno, lote) {
    const mod = normModulo(modulo);
    const t = normTurno(turno);
    const n = normLote(lote);
    if (n) {
      return ENSAYO_ENTRIES.find((e) => e.lote === n) || null;
    }
    if (mod && t) {
      return ENSAYO_ENTRIES.find((e) => e.modulo === mod && e.turno === t) || null;
    }
    return null;
  }

  function entries() {
    const list = Object.keys(BY_MOD_TURNO).map((k) => {
      const parts = k.split("|");
      const modulo = parts[0];
      const turno = normTurno(parts[1]);
      const valvular = BY_MOD_TURNO[k];
      return {
        key: k,
        modulo,
        turno,
        valvular,
        lote: String(valvular),
        variedad: VARIEDAD_BY_MT[k] || "",
        ensayo: false,
      };
    });
    ENSAYO_ENTRIES.forEach((e) => {
      const k = `${e.modulo}|T${e.turno}`;
      const label = ensayoLabel(e.lote);
      list.push({
        key: `${k}|L${e.lote}`,
        modulo: e.modulo,
        turno: e.turno,
        valvular: label,
        lote: e.lote,
        variedad: VARIEDAD_BY_MT[k] || "SEKOYA POP",
        ensayo: true,
      });
    });
    return list;
  }

  function lookup({ modulo, turno, lote } = {}) {
    const n = normLote(lote);
    const ens = ensayoLabel(n);
    if (ens) return ens;

    const mod = normModulo(modulo);
    const t = normTurno(turno);
    if (mod && t) {
      const v = BY_MOD_TURNO[`${mod}|T${t}`];
      if (typeof v === "string") return v;
      if (v != null) return v;
      // Turno solo ENSAYO (ej. M2 T7) sin lote aún
      const solo = ENSAYO_ENTRIES.find((e) => e.modulo === mod && e.turno === t);
      if (solo && !BY_MOD_TURNO[`${mod}|T${t}`]) return ensayoLabel(solo.lote);
    }
    if (n) {
      const hit = entries().find((e) => String(e.lote) === n);
      if (hit) return hit.valvular;
      const fromLote = Number(n);
      if (Number.isFinite(fromLote) && fromLote > 0) return fromLote;
    }
    return "";
  }

  function isEnsayoValvula(raw) {
    const s = String(raw || "").trim().toUpperCase();
    if (s === "ENSAYO") return true;
    return /\(\s*ENSAYO\s*\)$/i.test(s) || isEnsayoLote(s);
  }

  function hasModTurno(modulo, turno) {
    const k = mtKey(modulo, turno);
    if (!k) return false;
    if (BY_MOD_TURNO[k] != null) return true;
    const mod = normModulo(modulo);
    const t = normTurno(turno);
    return ENSAYO_ENTRIES.some((e) => e.modulo === mod && e.turno === t);
  }

  function moduloOptions(query) {
    const q = String(query || "").trim().toLowerCase();
    const seen = new Map();
    entries().forEach((e) => {
      if (!seen.has(e.modulo)) {
        seen.set(e.modulo, { id: e.modulo, label: e.modulo, meta: "Módulo" });
      }
    });
    let list = [...seen.values()].sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true })
    );
    if (q) {
      list = list.filter(
        (o) => o.id.toLowerCase().includes(q) || o.label.toLowerCase().includes(q)
      );
    }
    return list;
  }

  function turnoOptions(modulo, query) {
    const mod = normModulo(modulo);
    const q = String(query || "").trim().toLowerCase();
    if (!mod) return [];
    const seen = new Map();
    entries().forEach((e) => {
      if (e.modulo !== mod || seen.has(e.turno)) return;
      const varLabel = e.variedad || variedadFor(mod, e.turno);
      const hasEnsayo = ENSAYO_ENTRIES.some((x) => x.modulo === mod && x.turno === e.turno);
      const hasNum = BY_MOD_TURNO[`${mod}|T${e.turno}`] != null;
      let meta;
      if (hasEnsayo && hasNum) meta = `${varLabel} · Válvula / ENSAYO`;
      else if (hasEnsayo) meta = `${varLabel} · ENSAYO`;
      else meta = varLabel ? `${varLabel} · Válvula ${e.valvular}` : `Válvula ${e.valvular}`;
      seen.set(e.turno, {
        id: String(e.turno),
        label: `Turno ${e.turno}`,
        meta,
        variedad: varLabel,
      });
    });
    let list = [...seen.values()].sort((a, b) => Number(a.id) - Number(b.id));
    if (q) {
      list = list.filter(
        (o) =>
          o.id.includes(q) ||
          o.label.toLowerCase().includes(q) ||
          String(o.meta || "").toLowerCase().includes(q) ||
          String(o.variedad || "").toLowerCase().includes(q)
      );
    }
    return list;
  }

  function lotesFor(modulo, turno) {
    const mod = normModulo(modulo);
    const t = normTurno(turno);
    if (!mod || !t) return [];
    const nums = [];
    const v = BY_MOD_TURNO[`${mod}|T${t}`];
    if (typeof v === "number") nums.push(String(v));
    ENSAYO_ENTRIES.forEach((e) => {
      if (e.modulo === mod && e.turno === t) nums.push(e.lote);
    });
    return [...new Set(nums)];
  }

  function valvulaOptions({ modulo, turno, lote, query } = {}) {
    const mod = normModulo(modulo);
    const t = normTurno(turno);
    const loteN = normLote(lote);
    const q = String(query || "").trim().toLowerCase();
    let list = entries().filter((e) => {
      if (mod && e.modulo !== mod) return false;
      if (t && e.turno !== t) return false;
      if (loteN && String(e.lote) !== loteN) return false;
      return true;
    });
    if (q) {
      list = list.filter(
        (e) =>
          String(e.valvular).toLowerCase().includes(q) ||
          String(e.lote).includes(q) ||
          e.modulo.toLowerCase().includes(q) ||
          String(e.turno).includes(q)
      );
    }
    return list.map((e) => ({
      id: String(e.valvular),
      label: String(e.valvular),
      meta: e.ensayo
        ? `${e.modulo} · Turno ${e.turno} · Lote ${e.lote}`
        : `${e.modulo} · Turno ${e.turno}`,
      raw: e,
    }));
  }

  return {
    BY_MOD_TURNO,
    ENSAYO_ENTRIES,
    VARIEDAD_BY_MT,
    lookup,
    ensayoLabel,
    isEnsayoValvula,
    isEnsayoLote,
    ensayoEntryFor,
    variedadFor,
    hasModTurno,
    normModulo,
    normTurno,
    entries,
    moduloOptions,
    turnoOptions,
    lotesFor,
    valvulaOptions,
  };
})();
