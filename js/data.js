/** Catálogos de campo: lotes, trabajadores (DNI), supervisores (DNI) */
window.QB = window.QB || {};

QB.Data = (() => {
  let ready = false;
  let loading = null;
  let lotes = [];
  let lotesById = {};
  let trabajadores = {};
  let supervisores = {};
  /** Catálogo fijo Regador — APP RIEGO (solo estos) */
  let evaluadores = {
    "41613772": { nombre: "VIGO VILLANUEVA MIGUEL" },
    "42479113": { nombre: "RISCO VARGAS JHONNY" },
    "43662384": { nombre: "CUENCA FLORES ELADIO" },
    "44362126": { nombre: "RISCO VARGAS OSCAR" },
    "47863897": { nombre: "ZORRILLA LOPEZ RAUL JESUS" },
    "48529665": { nombre: "CHIGNE QUISPE ARTURO" },
    "60412475": { nombre: "SANCHEZ VARGAS ELIAS" },
    "60543709": { nombre: "GUEVARA NEYRA ANTHONY" },
    "63090039": { nombre: "VARGAS SIQUIHUA ROYER" },
    "72468528": { nombre: "MORALES QUIROZ EDUARDO YAIR" },
    "74292250": { nombre: "VIGO QUITO JAIRO" },
    "75079075": { nombre: "FLORES QUITO GERSON" },
    "75565198": { nombre: "SANDOVAL MORALES ALEXANDER HOOVER" },
  };

  /** Semilla embebida (lotes / supervisores / preview cosecha) si falla fetch */
  function applySeed_() {
    const seed = (window.QB && window.QB.SEED) || {};
    if (seed.evaluadores) {
      // Si el embebido está vacío, cargar semilla completa
      if (Object.keys(evaluadores).length === 0) {
        evaluadores = Object.assign({}, seed.evaluadores);
      }
    }
    if (seed.supervisores && Object.keys(supervisores).length === 0) {
      supervisores = Object.assign({}, seed.supervisores);
    }
    if (seed.trabajadoresPreview && Object.keys(trabajadores).length === 0) {
      trabajadores = Object.assign({}, seed.trabajadoresPreview);
    }
    // Lotes siempre desde semilla si el catálogo aún está vacío (offline / SW)
    if (Array.isArray(seed.lotes) && seed.lotes.length && lotes.length === 0) {
      buildLoteCatalog(seed.lotes);
    }
  }
  applySeed_();

  function dataUrl_(rel) {
    try {
      return new URL(rel, document.baseURI || location.href).href;
    } catch {
      return rel;
    }
  }

  /** Corrige UTF-8 leído como Latin-1 (ej. MÃ¡gica → Mágica) */
  function fixMojibake_(s) {
    const t = String(s || "");
    if (!t || !/[\u00C3\u00C2]/.test(t)) return t;
    try {
      const bytes = Uint8Array.from(t, (ch) => ch.charCodeAt(0) & 0xff);
      return new TextDecoder("utf-8").decode(bytes);
    } catch {
      return t;
    }
  }

  const VARIEDAD_MAP = {
    "SEKOYA POP": "S. Pop",
    "S. POP": "S. Pop",
    "S. Pop": "S. Pop",
    "Sekoya Pop": "S. Pop",
    MAGICA: "Mágica",
    "MAGICA": "Mágica",
    "MÁGICA": "Mágica",
    "Mágica": "Mágica",
    Magica: "Mágica",
    "MÃ¡gica": "Mágica",
  };

  function etapaKind(etapa) {
    const e = String(etapa || "")
      .trim()
      .toUpperCase();
    if (e.includes("II")) return "II";
    if (e.includes("I") || e.includes("LICAPA")) return "I";
    return "";
  }

  /** Un lote por número: si hay I+II → etiqueta Licapa I/II y datos de Licapa I */
  function buildLoteCatalog(raw) {
    const all = Array.isArray(raw) ? raw : [];
    const groups = new Map();
    all.forEach((l) => {
      const n = String(l.lote ?? "").trim();
      if (!n) return;
      if (!groups.has(n)) groups.set(n, []);
      groups.get(n).push(l);
    });

    lotesById = {};
    lotes = [];

    all.forEach((l) => {
      const cod = String(l.codLote || "").trim();
      if (cod) lotesById[cod] = l;
    });

    groups.forEach((group, num) => {
      const licapaI = group.find((l) => etapaKind(l.etapa) === "I");
      const licapaII = group.find((l) => etapaKind(l.etapa) === "II");
      let pick;
      let etapaLabel;
      if (licapaI && licapaII) {
        pick = licapaI;
        etapaLabel = "Licapa I/II";
      } else if (licapaI) {
        pick = licapaI;
        etapaLabel = "Licapa I";
      } else if (licapaII) {
        pick = licapaII;
        etapaLabel = "Licapa II";
      } else {
        pick = group[0];
        etapaLabel = String(pick.etapa || "").trim();
      }
      const entry = { ...pick, lote: num, etapa: etapaLabel };
      lotes.push(entry);
      lotesById[num] = entry;
      lotesById[`Q${num}`] = entry;
      if (pick.codLote) lotesById[String(pick.codLote)] = entry;
      group.forEach((l) => {
        const cod = String(l.codLote || "").trim();
        if (cod) lotesById[cod] = entry;
      });
    });

    lotes.sort((a, b) => {
      const na = Number(a.lote) || 0;
      const nb = Number(b.lote) || 0;
      return na !== nb ? na - nb : String(a.etapa).localeCompare(String(b.etapa));
    });
  }

  async function load() {
    if (ready) return true;
    if (loading) return loading;

    applySeed_();

    const fetchJson = (url, fallback) =>
      fetch(dataUrl_(url), { cache: "no-cache" })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        })
        .catch(() => fallback);

    loading = Promise.all([
      fetchJson("./data/lotes-licapa.json", null),
      fetchJson("./data/trabajadores.json", null),
      fetchJson("./data/supervisores-cosecha.json", null),
      fetchJson("./data/evaluadores.json", null),
    ])
      .then(([lotesJson, trabJson, supJson, evalJson]) => {
        // Nunca vaciar el catálogo si el fetch falló o vino vacío
        if (Array.isArray(lotesJson) && lotesJson.length) {
          buildLoteCatalog(lotesJson);
        }
        // Solo reemplazar si el fetch trajo datos reales
        if (trabJson?.byDni && Object.keys(trabJson.byDni).length) {
          trabajadores = trabJson.byDni;
        }
        if (supJson?.byDni && Object.keys(supJson.byDni).length) {
          supervisores = { ...supervisores, ...supJson.byDni };
        }
        if (evalJson?.byDni && Object.keys(evalJson.byDni).length) {
          // Lista oficial: reemplazar (no fusionar con lista vieja)
          evaluadores = Object.assign({}, evalJson.byDni);
        }
        // Si el fetch falló, conservar la semilla embebida
        applySeed_();
        ready = true;
        loading = null;
        return (
          Object.keys(evaluadores).length > 0 ||
          Object.keys(trabajadores).length > 0 ||
          lotes.length > 0
        );
      })
      .catch(() => {
        applySeed_();
        ready = true;
        loading = null;
        return Object.keys(evaluadores).length > 0;
      });
    return loading;
  }

  function mapVariedad(raw) {
    if (!raw) return "";
    const key = fixMojibake_(String(raw).trim());
    return VARIEDAD_MAP[key] || VARIEDAD_MAP[key.toUpperCase()] || key;
  }

  /**
   * Solo primer apellido + primer nombre.
   * "AGUIRRE NORIEGA MARCO ANTONIO" → "AGUIRRE MARCO"
   */
  function shortName(nombre) {
    const parts = String(nombre || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length <= 1) return parts[0] || "";
    if (parts.length === 2) return `${parts[0]} ${parts[1]}`;
    // APELLIDO1 APELLIDO2 NOMBRE1 [NOMBRE2...]
    return `${parts[0]} ${parts[2]}`;
  }

  function personLabel(dni, nombre) {
    const short = shortName(nombre) || String(nombre || "").trim() || dni;
    return dni ? `${dni} — ${short}` : short;
  }

  function loteLabel(l) {
    if (!l) return "";
    const etapa = String(l.etapa || "").trim().toUpperCase();
    const n = String(l.lote ?? "").trim();
    return etapa ? `${n} - ${etapa}` : n;
  }

  function loteShortLabel(l) {
    if (!l) return "";
    const n = String(l.lote ?? "").trim();
    return n || "";
  }

  function loteOptions(query) {
    return loteOptionsFiltered({ query });
  }

  /** Módulos únicos del catálogo (para cascada aforos) */
  function moduloOptions(query) {
    const q = String(query || "").trim().toLowerCase();
    const seen = new Map();
    for (const l of lotes) {
      const m = String(l.modulo || "").trim();
      if (!m || seen.has(m.toUpperCase())) continue;
      seen.set(m.toUpperCase(), { id: m, label: m, meta: "Módulo" });
    }
    let list = [...seen.values()].sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true })
    );
    if (q) {
      list = list.filter(
        (o) =>
          o.id.toLowerCase().includes(q) || o.label.toLowerCase().includes(q)
      );
    }
    return list;
  }

  /** Turnos disponibles para un módulo */
  function turnoOptions(modulo, query) {
    const mod = String(modulo || "").trim().toUpperCase();
    const q = String(query || "").trim().toLowerCase();
    const seen = new Map();
    for (const l of lotes) {
      if (mod && String(l.modulo || "").trim().toUpperCase() !== mod) continue;
      const t = l.turno != null && l.turno !== "" ? String(l.turno) : "";
      if (!t || seen.has(t)) continue;
      seen.set(t, {
        id: t,
        label: `Turno ${t}`,
        meta: mod || "Turno",
      });
    }
    let list = [...seen.values()].sort((a, b) => Number(a.id) - Number(b.id));
    if (q) {
      list = list.filter(
        (o) => o.id.includes(q) || o.label.toLowerCase().includes(q)
      );
    }
    return list;
  }

  /** Lotes filtrados por módulo y/o turno */
  function loteOptionsFiltered({ modulo, turno, query } = {}) {
    const mod = String(modulo || "").trim().toUpperCase();
    const tur = String(turno || "").trim();
    const q = String(query || "").trim().toLowerCase();
    let list = lotes
      .filter((l) => {
        if (mod && String(l.modulo || "").trim().toUpperCase() !== mod) return false;
        if (tur && String(l.turno ?? "") !== tur) return false;
        return true;
      })
      .map((l) => ({
        id: String(l.codLote || l.lote),
        label: loteLabel(l),
        meta: `${l.modulo || "—"} · Turno ${l.turno ?? "—"}`,
        raw: l,
      }));
    if (!q) return list.slice(0, 80);
    return list
      .filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.label.toLowerCase().includes(q) ||
          String(o.raw.lote || "")
            .toLowerCase()
            .includes(q) ||
          String(o.raw.etapa || "")
            .toLowerCase()
            .includes(q) ||
          String(o.raw.modulo || "")
            .toLowerCase()
            .includes(q) ||
          o.meta.toLowerCase().includes(q)
      )
      .slice(0, 80);
  }

  function findLote(id) {
    const raw = String(id ?? "").trim();
    if (!raw) return null;
    if (lotesById[raw]) return lotesById[raw];

    // "Lote 138 - Licapa I" | "Lote 138" | "Q138" | "138"
    const fromLabel = raw.match(/^lote\s*([^\s\-–—]+)/i);
    if (fromLabel && lotesById[fromLabel[1]]) return lotesById[fromLabel[1]];

    const noPrefix = raw.replace(/^lote\s*/i, "").trim();
    if (noPrefix && lotesById[noPrefix]) return lotesById[noPrefix];

    const qForm = noPrefix.replace(/^q/i, "").trim();
    if (qForm && lotesById[qForm]) return lotesById[qForm];
    if (qForm && lotesById[`Q${qForm}`]) return lotesById[`Q${qForm}`];

    // codLote parcial: ...LT138
    const lt = raw.match(/LT\s*(\d+)/i) || raw.match(/(?:^|[^\d])(\d{1,4})$/);
    if (lt && lotesById[lt[1]]) return lotesById[lt[1]];

    const digitsOnly = raw.replace(/\D/g, "");
    if (digitsOnly && lotesById[digitsOnly]) return lotesById[digitsOnly];

    const lower = raw.toLowerCase();
    return (
      lotes.find(
        (l) =>
          String(l.codLote || "") === raw ||
          String(l.lote) === raw ||
          String(l.lote) === digitsOnly ||
          loteLabel(l).toLowerCase() === lower ||
          loteShortLabel(l).toLowerCase() === lower
      ) || null
    );
  }

  /** Módulo + turno (+ etapa) siempre desde catálogo de lotes */
  function loteMeta(loteId) {
    const L = findLote(loteId);
    if (!L) return { modulo: "", turno: "", lote: String(loteId || ""), etapa: "" };
    return {
      lote: String(L.lote),
      modulo: L.modulo || "",
      turno: L.turno != null && L.turno !== "" ? String(L.turno) : "",
      etapa: L.etapa || "",
      variedad: L.variedad || "",
      codLote: L.codLote || "",
      raw: L,
    };
  }

  function searchDni(map, query, limit = 40) {
    const digits = String(query || "").replace(/\D/g, "");
    if (digits.length < 3) return [];
    const out = [];
    for (const dni of Object.keys(map)) {
      if (!dni.includes(digits)) continue;
      const p = map[dni];
      const full = (p.nombre || "").trim();
      out.push({
        id: dni,
        label: full || dni,
        meta: `DNI ${dni}${p.cargo ? ` · ${p.cargo}` : ""}`,
        nombre: full,
        nombreCorto: shortName(full),
        cargo: p.cargo || "",
      });
      if (out.length >= limit) break;
    }
    return out;
  }

  function personOptions(map, query, opts = {}) {
    const metaLabel = opts.metaLabel || "";
    const minList = opts.minList || 40;
    const limit = opts.limit || 60;
    const q = String(query || "").trim().toLowerCase();
    const digits = String(query || "").replace(/\D/g, "");
    const out = [];

    const push = (dni, p) => {
      const full = (p.nombre || "").trim();
      out.push({
        id: dni,
        label: full || dni,
        meta: metaLabel
          ? `${metaLabel} · DNI - ${dni}`
          : `DNI - ${dni}`,
        nombre: full,
        nombreCorto: shortName(full),
        cargo: p.cargo || "",
        dni: String(dni),
      });
    };

    const dnis = Object.keys(map || {});

    // Sin búsqueda: listado de previsualización (ordenado por nombre)
    if (!q) {
      const preview = dnis
        .map((dni) => ({ dni, p: map[dni], nom: (map[dni]?.nombre || "").trim() }))
        .sort((a, b) => a.nom.localeCompare(b.nom, "es") || a.dni.localeCompare(b.dni));
      for (const row of preview) {
        push(row.dni, row.p);
        if (out.length >= minList) break;
      }
      return out;
    }

    for (const dni of dnis) {
      const p = map[dni];
      const nombre = (p.nombre || "").toLowerCase();
      const byDni = digits.length >= 2 && dni.includes(digits);
      const byName = q.length >= 2 && nombre.includes(q);
      if (byDni || byName) {
        push(dni, p);
        if (out.length >= limit) break;
      }
    }
    return out;
  }

  function searchTrabajadores(q) {
    return personOptions(trabajadores, q, {
      minList: 50,
      limit: 80,
    });
  }

  function searchSupervisores(q) {
    return personOptions(supervisores, q, {
      minList: 40,
      limit: 60,
    });
  }

  function mapToOpts(map, limit, metaLabel) {
    const out = [];
    for (const dni of Object.keys(map)) {
      const p = map[dni];
      const full = (p.nombre || "").trim();
      out.push({
        id: personLabel(dni, full),
        label: full || dni,
        meta: metaLabel ? `${metaLabel} · DNI ${dni}` : `DNI ${dni}`,
        nombre: full,
        nombreCorto: shortName(full),
        dni,
      });
      if (out.length >= limit) break;
    }
    return out;
  }

  /** Lista fija de evaluadores (código + nombre). Solo catálogo oficial. */
  function evaluadorOptions(query) {
    applySeed_();
    const q = String(query || "").trim().toLowerCase();
    const digits = String(query || "").replace(/\D/g, "");
    const out = [];
    const map = evaluadores || {};

    const dnis = Object.keys(map).sort(function (a, b) {
      const na = ((map[a] && map[a].nombre) || "").localeCompare((map[b] && map[b].nombre) || "", "es");
      return na || a.localeCompare(b);
    });
    for (let i = 0; i < dnis.length; i++) {
      const dni = dnis[i];
      const p = map[dni] || {};
      const full = String(p.nombre || "").trim();
      if (!full || full === dni) continue;
      const nombre = full.toLowerCase();
      const short = shortName(full).toLowerCase();
      if (
        q &&
        nombre.indexOf(q) === -1 &&
        short.indexOf(q) === -1 &&
        !(digits.length >= 2 && dni.indexOf(digits) !== -1)
      ) {
        continue;
      }
      out.push({
        id: personLabel(dni, full),
        label: full || dni,
        meta: "DNI - " + dni,
        nombre: full,
        nombreCorto: shortName(full),
        dni: String(dni),
      });
    }
    return out;
  }

  /** "18851808 — AGUIRRE NORIEGA MARCO ANTONIO" → "18851808 — AGUIRRE MARCO" */
  function formatStoredPerson(val) {
    if (!val) return "";
    const m = String(val).match(/^(\d+)\s*[—\-]\s*(.+)$/);
    if (m) return personLabel(m[1], m[2]);
    return shortName(val) || String(val).trim();
  }

  function personByDni(kind, dni) {
    if (kind === "evaluador") return evaluadores[String(dni)] || null;
    const map = kind === "supervisor" ? supervisores : trabajadores;
    return map[String(dni)] || null;
  }

  function isReady() {
    return ready;
  }

  /** Reintenta cargar catálogos si quedaron vacíos */
  async function ensureEvaluadores() {
    applySeed_();
    if (Object.keys(evaluadores).length > 0) return true;
    ready = false;
    loading = null;
    const ok = await load();
    return ok && Object.keys(evaluadores).length > 0;
  }

  async function ensureCatalogs() {
    applySeed_();
    if (
      lotes.length > 0 ||
      Object.keys(evaluadores).length > 0 ||
      Object.keys(trabajadores).length > 0 ||
      Object.keys(supervisores).length > 0
    ) {
      // Si hay personas pero no lotes, forzar recarga una vez
      if (lotes.length === 0) {
        ready = false;
        loading = null;
        await load();
        applySeed_();
      }
      return lotes.length > 0 || Object.keys(evaluadores).length > 0;
    }
    ready = false;
    loading = null;
    return load();
  }

  function loteCount() {
    return lotes.length;
  }

  return {
    load,
    isReady,
    ensureEvaluadores,
    ensureCatalogs,
    loteOptions,
    loteOptionsFiltered,
    moduloOptions,
    turnoOptions,
    findLote,
    loteMeta,
    loteLabel,
    loteShortLabel,
    loteCount,
    mapVariedad,
    shortName,
    personLabel,
    formatStoredPerson,
    searchTrabajadores,
    searchSupervisores,
    evaluadorOptions,
    personByDni,
  };
})();
