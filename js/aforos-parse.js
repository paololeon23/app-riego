/** Utilidades aforos: volumen ml/lt, fecha, filas Sheet */
window.QB = window.QB || {};

QB.AforosParse = (() => {
  const PCT_MIN = 20;
  const PCT_MAX = 30;

  /** 4.000ml → 4000 · 2.lt → 2000 · 800 → 800 */
  function parseVolume(raw) {
    let s = String(raw ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/,/g, ".");
    if (!s) return null;
    let unit = "ml";
    if (/ml$/.test(s)) {
      s = s.replace(/ml$/, "");
    } else if (/(?:litros?|lts?|lt)$/i.test(s)) {
      unit = "lt";
      s = s.replace(/(?:litros?|lts?|lt)$/i, "");
    } else if (/^\d+\.?l$/.test(s)) {
      unit = "lt";
      s = s.replace(/l$/, "");
    }
    s = s.replace(/\.$/, "");
    if (!s) return null;
    let n;
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) n = Number(s.replace(/\./g, ""));
    else n = Number(s);
    if (!Number.isFinite(n) || n < 0) return null;
    if (unit === "lt") n = Math.round(n * 1000);
    return Math.round(n);
  }

  function parseFechaToken(raw) {
    const s = String(raw || "").trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (!m) return "";
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    let yy = Number(m[3]);
    if (yy < 100) yy += 2000;
    if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return "";
    return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }

  function fechaDisplay(iso) {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return String(iso || "");
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  function isoWeek(iso) {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "";
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }

  function pctDrenajeReal(aforo, b1, b2) {
    const a = Number(aforo) || 0;
    if (a <= 0) return 0;
    return Math.round((((Number(b1) || 0) + (Number(b2) || 0)) / 2 / a) * 100);
  }

  function formTag(turno, modulo) {
    const mod = QB.VALVULAR ? QB.VALVULAR.normModulo(modulo) : String(modulo || "");
    return `T${turno} - ${mod}`;
  }

  /** Arma filas Sheet desde inputs del formulario */
  function buildRowsFromForm(meta, turnos) {
    meta = meta || {};
    const fecha = parseFechaToken(meta.fecha) || String(meta.fecha || "").trim();
    const anio = fecha ? Number(String(fecha).slice(0, 4)) : "";
    const semana = fecha ? isoWeek(fecha) : "";
    const fundo = meta.fundo || "";
    const variedad = meta.variedad || "";
    const ubicacion = String(meta.ubicacion || "MEDIO").trim().toUpperCase() || "MEDIO";
    const eto = meta.eto !== "" && meta.eto != null ? Number(meta.eto) : "";
    const lamina = meta.lamina !== "" && meta.lamina != null ? Number(meta.lamina) : "";
    const list = Array.isArray(turnos) ? turnos : [];
    const out = [];

    for (let i = 0; i < list.length; i++) {
      const t = list[i] || {};
      const turno = Number(t.turno);
      const aforo = parseVolume(t.aforo);
      if (!Number.isFinite(turno) || turno <= 0) continue;
      if (aforo == null || aforo <= 0) continue;
      let modulo = String(t.modulo || meta.modulo || "").trim().toUpperCase();
      if (modulo && !modulo.startsWith("M")) modulo = `M${modulo.replace(/\D/g, "")}`;
      if (QB.VALVULAR?.normModulo) modulo = QB.VALVULAR.normModulo(modulo);
      const loteNum = t.lote ? String(t.lote) : "";
      const drenaje1 = parseVolume(t.drenaje1) || 0;
      const drenaje2 = parseVolume(t.drenaje2) || 0;
      let valvular =
        t.valvula !== "" && t.valvula != null
          ? Number(t.valvula) || t.valvula
          : "";
      if (valvular === "" && QB.VALVULAR?.lookup) {
        valvular = QB.VALVULAR.lookup({ modulo, turno, lote: loteNum });
      }
      // Separación interna: lote → Licapa I (Sekoya Pop) / Licapa II (Mágica)
      const L =
        QB.Data?.findLote && (t.codLote || loteNum)
          ? QB.Data.findLote(t.codLote || loteNum)
          : null;
      let varRow = "";
      if (L?.variedad) {
        varRow = QB.Data.mapVariedad
          ? QB.Data.mapVariedad(L.variedad) || L.variedad
          : L.variedad;
      } else if (variedad) {
        varRow = variedad;
      }
      let fundoRow = "";
      const kind = L?.etapa && QB.Data?.etapaKind ? QB.Data.etapaKind(L.etapa) : "";
      if (kind === "I" || /pop/i.test(String(varRow))) {
        fundoRow = "LICAPA I";
        varRow = varRow || "S. Pop";
      } else if (kind === "II" || /m[aá]gic/i.test(String(varRow))) {
        fundoRow = "LICAPA II";
        varRow = varRow || "Mágica";
      } else if (fundo) {
        fundoRow = fundo;
      }
      out.push({
        anio,
        fecha: fechaDisplay(fecha),
        fechaIso: fecha,
        semana,
        fundo: fundoRow,
        variedad: varRow || "",
        modulo,
        turno,
        valvular,
        valvula: valvular,
        ubicacion: "MEDIO",
        eto: Number.isFinite(eto) ? eto : "",
        lamina: Number.isFinite(lamina) ? lamina : "",
        drenaje1,
        drenaje2,
        aforo,
        pctReal: pctDrenajeReal(aforo, drenaje1, drenaje2),
        pctMinimo: PCT_MIN,
        pctMaximo: PCT_MAX,
        status: "",
        form: formTag(turno, modulo),
        lote: loteNum,
        codLote: t.codLote ? String(t.codLote) : L?.codLote || "",
      });
    }
    return out;
  }

  return {
    parseVolume,
    parseFechaToken,
    fechaDisplay,
    isoWeek,
    pctDrenajeReal,
    formTag,
    buildRowsFromForm,
    PCT_MIN,
    PCT_MAX,
  };
})();
