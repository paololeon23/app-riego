/** Valvular por Módulo + Turno (Licapa I / II / III) */
window.QB = window.QB || {};

QB.VALVULAR = (() => {
  /** Clave M{n}|T{t} → N° válvula / lote */
  const BY_MOD_TURNO = {
    "M1|T1": 4, "M1|T3": 11, "M1|T5": 21, "M1|T7": 31, "M1|T9": 41,
    "M2|T2": 55, "M2|T4": 65, "M2|T6": 74, "M2|T8": 82, "M2|T10": 92,
    "M3|T1": 97, "M3|T3": 105, "M3|T5": 111, "M3|T7": 120, "M3|T9": 130,
    "M4|T2": 144, "M4|T4": 152, "M4|T6": 163, "M4|T8": 170, "M4|T10": 177,
    "M5|T1": 184, "M5|T3": 192, "M5|T9": 219,
    /* M6: T2/T4 Sekoya Pop (Licapa I) · T8/T10 Mágica (Licapa II) */
    "M6|T2": 249, "M6|T4": 251, "M6|T8": 260, "M6|T10": 271,
    "M7|T1": 283, "M7|T3": 293, "M7|T5": 301, "M7|T7": 309, "M7|T9": 318,
    "M8|T2": 330, "M8|T4": 338, "M8|T6": 349, "M8|T8": 360, "M8|T10": 368,
    "M9|T1": 374, "M9|T3": 384, "M9|T5": 396, "M9|T7": 405, "M9|T9": 414,
    "M10|T5": 200, "M10|T6": 204, "M10|T7": 202, "M10|T8": 216, "M10|T10": 223, "M10|T11": 209,
  };

  /** Variedad oficial por módulo+turno — siempre MAYÚSCULAS en UI */
  const VARIEDAD_BY_MT = {
    "M1|T1": "SEKOYA POP", "M1|T3": "SEKOYA POP", "M1|T5": "SEKOYA POP", "M1|T7": "SEKOYA POP", "M1|T9": "SEKOYA POP",
    "M2|T2": "SEKOYA POP", "M2|T4": "SEKOYA POP", "M2|T6": "SEKOYA POP", "M2|T8": "SEKOYA POP", "M2|T10": "SEKOYA POP",
    "M3|T1": "SEKOYA POP", "M3|T3": "SEKOYA POP", "M3|T5": "SEKOYA POP", "M3|T7": "SEKOYA POP", "M3|T9": "SEKOYA POP",
    "M4|T2": "SEKOYA POP", "M4|T4": "SEKOYA POP", "M4|T6": "SEKOYA POP", "M4|T8": "SEKOYA POP", "M4|T10": "SEKOYA POP",
    "M5|T1": "SEKOYA POP", "M5|T3": "SEKOYA POP", "M5|T9": "SEKOYA POP",
    "M6|T2": "SEKOYA POP", "M6|T4": "SEKOYA POP", "M6|T8": "MAGICA", "M6|T10": "MAGICA",
    "M7|T1": "MAGICA", "M7|T3": "MAGICA", "M7|T5": "MAGICA", "M7|T7": "MAGICA", "M7|T9": "MAGICA",
    "M8|T2": "MAGICA", "M8|T4": "MAGICA", "M8|T6": "MAGICA", "M8|T8": "MAGICA", "M8|T10": "MAGICA",
    "M9|T1": "MAGICA", "M9|T3": "MAGICA", "M9|T5": "MAGICA", "M9|T7": "MAGICA", "M9|T9": "MAGICA",
    "M10|T5": "SEKOYA POP", "M10|T6": "SEKOYA POP", "M10|T7": "SEKOYA POP", "M10|T11": "SEKOYA POP",
    "M10|T8": "MAGICA", "M10|T10": "MAGICA",
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

  function mtKey(modulo, turno) {
    const mod = normModulo(modulo);
    const t = normTurno(turno);
    return mod && t ? `${mod}|T${t}` : "";
  }

  function variedadFor(modulo, turno) {
    const k = mtKey(modulo, turno);
    return k ? VARIEDAD_BY_MT[k] || "" : "";
  }

  function entries() {
    return Object.keys(BY_MOD_TURNO).map((k) => {
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
      };
    });
  }

  function lookup({ modulo, turno, lote } = {}) {
    const fromLote = Number(String(lote || "").replace(/\D/g, ""));
    if (Number.isFinite(fromLote) && fromLote > 0) {
      const hit = entries().find((e) => e.valvular === fromLote);
      if (hit) return hit.valvular;
      return fromLote;
    }
    const mod = normModulo(modulo);
    const t = normTurno(turno);
    if (!mod || !t) return "";
    const v = BY_MOD_TURNO[`${mod}|T${t}`];
    return v != null ? v : "";
  }

  /** true si ese módulo+turno es válido para aforos SFR */
  function hasModTurno(modulo, turno) {
    const k = mtKey(modulo, turno);
    return !!(k && BY_MOD_TURNO[k] != null);
  }

  /** Módulos que tienen válvula en la tabla */
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

  /** Turnos con válvula para un módulo (incluye variedad en meta) */
  function turnoOptions(modulo, query) {
    const mod = normModulo(modulo);
    const q = String(query || "").trim().toLowerCase();
    if (!mod) return [];
    const seen = new Map();
    entries().forEach((e) => {
      if (e.modulo !== mod || seen.has(e.turno)) return;
      const varLabel = e.variedad || variedadFor(mod, e.turno);
      seen.set(e.turno, {
        id: String(e.turno),
        label: varLabel ? `Turno ${e.turno} · ${varLabel}` : `Turno ${e.turno}`,
        meta: varLabel ? `${varLabel} · Válvula ${e.valvular}` : `Válvula ${e.valvular}`,
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

  /** N° de lote/válvula de referencia para módulo + turno */
  function lotesFor(modulo, turno) {
    const mod = normModulo(modulo);
    const t = normTurno(turno);
    if (!mod || !t) return [];
    return entries()
      .filter((e) => e.modulo === mod && e.turno === t)
      .map((e) => String(e.valvular));
  }

  /** Opciones de válvula filtradas por módulo / turno / lote */
  function valvulaOptions({ modulo, turno, lote, query } = {}) {
    const mod = normModulo(modulo);
    const t = normTurno(turno);
    const loteN = Number(String(lote || "").replace(/\D/g, ""));
    const q = String(query || "").trim().toLowerCase();
    let list = entries().filter((e) => {
      if (mod && e.modulo !== mod) return false;
      if (t && e.turno !== t) return false;
      if (loteN && e.valvular !== loteN) return false;
      return true;
    });
    if (q) {
      list = list.filter(
        (e) =>
          String(e.valvular).includes(q) ||
          e.modulo.toLowerCase().includes(q) ||
          String(e.turno).includes(q)
      );
    }
    return list.map((e) => ({
      id: String(e.valvular),
      label: String(e.valvular),
      meta: `${e.modulo} · Turno ${e.turno}${e.variedad ? ` · ${e.variedad}` : ""}`,
      raw: e,
    }));
  }

  return {
    BY_MOD_TURNO,
    VARIEDAD_BY_MT,
    lookup,
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
