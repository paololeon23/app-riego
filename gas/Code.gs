/**
 * APP RIEGO — Google Apps Script
 * Hojas separadas:
 *   - "LICAPA"      ← Sekoya Pop (antes Licapa I)
 *   - "LICAPA II"   ← Mágica
 * En celda FUNDO: "LICAPA" / "LICAPA II"
 * ------------------------------------------------------------
 * SETUP:
 * 1) Pegar este archivo en el Apps Script del Sheet
 * 2) (Opcional) Ejecutar setupAforos() una vez (renombra hojas viejas)
 * 3) Implementar → Web App → URL …/exec → js/config.js
 */

var SHEET_LICAPA_I = 'LICAPA';
var SHEET_LICAPA_II = 'LICAPA II';
/** Nombres antiguos → se renombran en setupAforos / getOrCreate */
var SHEET_LICAPA_I_LEGACY = ['Licapa I - Sekoya Pop', 'Licapa I', 'LICAPA I'];
var SHEET_LICAPA_II_LEGACY = ['Licapa II - Mágica', 'Licapa II'];
/** La hoja "Aforos y Drenajes" YA NO se usa. */

var AFOROS_HEADERS = [
  'AÑO', 'FECHA', 'SEMANA', 'FUNDO', 'VARIEDAD', 'MÓDULO', 'TURNO', 'VALVULAR',
  'UBICACIÓN', 'ETo mm/día', 'LAMINA (mm)', 'REPOSICION mm',
  'CANTIDAD DRENAJE 1', 'CANTIDAD DRENAJE 2', 'CANTIDAD AFORO',
  '% DRENAJE REAL', '%MINIMO', '%MAXIMO', 'STATUS', 'FORM.',
  'HORA GUARDADA', 'DNI', 'REGADOR'
];

var AFORO_COLORS = {
  headerBg: '#001F5F',
  headerFg: '#FFFFFF',
  fecha: '#FFFF00',
  eto: '#FF33FF',
  lamina: '#E2EFDA',
  pctReal: '#FFC000',
  modulo: {
    M1: '#D9EAD3',
    M2: '#CFE2F3',
    M3: '#FFF2CC',
    M4: '#EAD1DC',
    M5: '#D0E0E3',
    M6: '#CCFF99',
    M7: '#FFCC99',
    M8: '#CCFFFF',
    M9: '#FFCCFF',
    M10: '#FCE5CD'
  }
};

var CACHE_TTL_SEC = 21600; // 6 h (límite máx. CacheService)
/** clientId enviados: se guardan también en Properties (anti-duplicado durable) */
var CLIENT_ID_PROP_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

/** Valvular oficial (1 lote = 1 válvula numérica) */
var VALVULAR_MAP = {
  'M1|T1': 4, 'M1|T3': 11, 'M1|T5': 21, 'M1|T7': 31, 'M1|T9': 41,
  'M2|T2': 55, 'M2|T4': 65, 'M2|T6': 74, 'M2|T8': 82, 'M2|T10': 92,
  'M3|T1': 97, 'M3|T3': 105, 'M3|T5': 111, 'M3|T7': 120, 'M3|T9': 130,
  'M4|T2': 144, 'M4|T4': 152, 'M4|T6': 163, 'M4|T8': 170, 'M4|T10': 177,
  'M5|T1': 184, 'M5|T3': 192, 'M5|T9': 219,
  'M6|T2': 249, 'M6|T4': 251, 'M6|T8': 260, 'M6|T10': 271,
  'M7|T1': 283, 'M7|T3': 293, 'M7|T5': 301, 'M7|T7': 309, 'M7|T9': 318,
  'M8|T2': 330, 'M8|T4': 338, 'M8|T6': 349, 'M8|T8': 360, 'M8|T10': 368,
  'M9|T1': 374, 'M9|T3': 384, 'M9|T5': 396, 'M9|T7': 405, 'M9|T9': 414,
  'M10|T7': 202, 'M10|T8': 216, 'M10|T11': 209
};

/** Lotes ENSAYO → columna VALVULAR = "80(ENSAYO)" / "84(ENSAYO)" */
var ENSAYO_LOTES = {
  '80': true,
  '84': true
};

function ensayoLabel_(loteN) {
  var n = String(loteN || '').replace(/\D/g, '');
  return n && ENSAYO_LOTES[n] ? n + '(ENSAYO)' : '';
}

function lookupValvular_(modulo, turno, lote) {
  var loteN = String(lote || '').replace(/\D/g, '');
  var ens = ensayoLabel_(loteN);
  if (ens) return ens;
  var mod = String(modulo || '').trim().toUpperCase().replace(/\s+/g, '');
  if (mod && mod.charAt(0) !== 'M') mod = 'M' + mod;
  var t = String(turno || '').replace(/^T/i, '').trim();
  if (mod && t) {
    var mapped = VALVULAR_MAP[mod + '|T' + Number(t)];
    if (typeof mapped === 'string') return mapped;
    if (mapped != null) return mapped;
  }
  var fromLote = Number(loteN);
  if (isFinite(fromLote) && fromLote > 0) return fromLote;
  return '';
}

function isoWeekAforo_(fechaISO) {
  var m = String(fechaISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  var d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  var day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function fechaDisplayAforo_(fechaISO) {
  var m = String(fechaISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(fechaISO || '');
  return m[3] + '/' + m[2] + '/' + m[1];
}

function colLetter_(n) {
  var s = '';
  var x = Number(n) || 0;
  while (x > 0) {
    var m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function aforoHeaderIndex_(headers, name) {
  var i = headers.indexOf(name);
  return i >= 0 ? i + 1 : -1;
}

function getHeaders_(sheet) {
  var lastCol = Math.min(sheet.getLastColumn(), 40);
  if (lastCol < 1) return [];
  var row = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var out = [];
  for (var i = 0; i < row.length; i++) out.push(String(row[i] || '').trim());
  while (out.length && out[out.length - 1] === '') out.pop();
  return out;
}

function ensureHeaders_(sheet, headers) {
  var existing = getHeaders_(sheet);
  if (!existing.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }
  var missing = [];
  for (var i = 0; i < headers.length; i++) {
    if (existing.indexOf(headers[i]) === -1) missing.push(headers[i]);
  }
  if (!missing.length) return;
  var start = existing.length + 1;
  sheet.getRange(1, start, 1, missing.length).setValues([missing]);
}

function styleAforoHeader_(sheet) {
  var n = AFOROS_HEADERS.length;
  var range = sheet.getRange(1, 1, 1, n);
  range.setBackground(AFORO_COLORS.headerBg);
  range.setFontColor(AFORO_COLORS.headerFg);
  range.setFontWeight('bold');
  range.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
}

function ensureAforosHeaders_(sheet) {
  var desired = AFOROS_HEADERS;
  var existing = getHeaders_(sheet);
  if (!existing.length) {
    sheet.getRange(1, 1, 1, desired.length).setValues([desired]);
    styleAforoHeader_(sheet);
    return;
  }
  var turi = existing.indexOf('TURNO');
  var vali = existing.indexOf('VALVULAR');
  if (vali === -1 && turi !== -1) {
    sheet.insertColumnAfter(turi + 1);
    sheet.getRange(1, turi + 2).setValue('VALVULAR');
  }
  ensureHeaders_(sheet, desired);
  styleAforoHeader_(sheet);
}

/** FUNDO en celda: LICAPA (Sekoya) o LICAPA II (Mágica) */
function normalizeFundoLabel_(sheetName) {
  if (sheetName === SHEET_LICAPA_II) return 'LICAPA II';
  if (sheetName === SHEET_LICAPA_I) return 'LICAPA';
  return '';
}

/** Quita tildes para detectar MAGICA / SEKOYA sin fallar */
function foldAsciiUpper_(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[ÁÀÄÂ]/g, 'A')
    .replace(/[ÉÈËÊ]/g, 'E')
    .replace(/[ÍÌÏÎ]/g, 'I')
    .replace(/[ÓÒÖÔ]/g, 'O')
    .replace(/[ÚÙÜÛ]/g, 'U');
}

/**
 * Regla fija (no invertir):
 *   SEKOYA POP → hoja LICAPA
 *   MAGICA     → hoja LICAPA II
 * Variedad manda; fundo es respaldo.
 */
function classifyAforoRowSheet_(row) {
  row = row || {};
  var variedad = foldAsciiUpper_(row.variedad);
  var fundo = foldAsciiUpper_(row.fundo);

  // 1) Variedad (fuente de verdad)
  if (variedad.indexOf('POP') !== -1 || variedad.indexOf('SEKOYA') !== -1) {
    return SHEET_LICAPA_I; // LICAPA
  }
  if (variedad.indexOf('MAG') !== -1) {
    return SHEET_LICAPA_II; // LICAPA II
  }

  // 2) Fundo
  if (fundo.indexOf('II') !== -1) return SHEET_LICAPA_II;
  if (fundo === 'LICAPA' || fundo.indexOf('LICAPA I') !== -1) return SHEET_LICAPA_I;

  return '';
}

function resolveAforoSheetName_(data, typeOrSheet) {
  var raw = String(typeOrSheet || '').trim();
  var t = raw.toLowerCase();
  if (t === 'licapa_i' || raw === SHEET_LICAPA_I || (/^licapa\s*i\b/i.test(raw) && !/ii/i.test(raw))) {
    return SHEET_LICAPA_I;
  }
  if (t === 'licapa_ii' || raw === SHEET_LICAPA_II || /licapa\s*ii/i.test(raw)) {
    return SHEET_LICAPA_II;
  }
  if (/^licapa$/i.test(raw)) return SHEET_LICAPA_I;

  // Preferir primera fila de aforo (tiene variedad/fundo correctos)
  var rows = data && data.aforo_rows;
  if (rows && rows.length) {
    var sheet0 = classifyAforoRowSheet_(rows[0]);
    if (sheet0) return sheet0;
  }

  var fondo = foldAsciiUpper_((data && data.fundo) || '');
  var variedad = foldAsciiUpper_((data && data.variedad) || '');
  if (variedad.indexOf('POP') !== -1 || variedad.indexOf('SEKOYA') !== -1) return SHEET_LICAPA_I;
  if (variedad.indexOf('MAG') !== -1) return SHEET_LICAPA_II;
  if (fundo.indexOf('II') !== -1) return SHEET_LICAPA_II;
  if (fundo === 'LICAPA' || fundo.indexOf('LICAPA I') !== -1) return SHEET_LICAPA_I;

  return '';
}

function renameLegacyAforoSheet_(ss, targetName, legacyNames) {
  if (ss.getSheetByName(targetName)) return;
  for (var i = 0; i < legacyNames.length; i++) {
    var old = ss.getSheetByName(legacyNames[i]);
    if (old) {
      try {
        old.setName(targetName);
        return;
      } catch (_) {}
    }
  }
}

function getOrCreateAforoSheet_(ss, name) {
  if (name === SHEET_LICAPA_I) renameLegacyAforoSheet_(ss, SHEET_LICAPA_I, SHEET_LICAPA_I_LEGACY);
  if (name === SHEET_LICAPA_II) renameLegacyAforoSheet_(ss, SHEET_LICAPA_II, SHEET_LICAPA_II_LEGACY);

  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, AFOROS_HEADERS.length).setValues([AFOROS_HEADERS]);
  }
  ensureAforosHeaders_(sheet);
  return sheet;
}

/** Manual: crea / prepara hojas LICAPA y LICAPA II */
function setupAforos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  getOrCreateAforoSheet_(ss, SHEET_LICAPA_I);
  getOrCreateAforoSheet_(ss, SHEET_LICAPA_II);
}

function formatHoraGuardada_(value) {
  var date = value ? new Date(value) : new Date();
  if (isNaN(date.getTime())) date = new Date();
  return Utilities.formatDate(date, 'America/Lima', 'hh:mm:ss a');
}

/** Separar "41613772 — NOMBRE" → { dni, nombre } */
function splitRegador_(raw) {
  var s = String(raw || '').trim();
  if (!s) return { dni: '', nombre: '' };
  var m = s.match(/^(\d{6,12})\s*[—\-–]\s*(.+)$/);
  if (m) return { dni: String(m[1]), nombre: String(m[2] || '').trim() };
  if (/^\d{6,12}$/.test(s)) return { dni: s, nombre: '' };
  return { dni: '', nombre: s };
}

function buildAforoMatrix_(data, fechaISO, horaGuardada) {
  var list = data && data.aforo_rows;
  if (!list || !list.length) throw new Error('Sin filas de aforo (aforo_rows)');
  for (var vi = 0; vi < list.length; vi++) {
    var vr = list[vi] || {};
    var va = Number(vr.aforo) || 0;
    var vb1 = Number(vr.drenaje1) || 0;
    var vb2 = Number(vr.drenaje2) || 0;
    if (!(va > vb1) || !(va > vb2)) {
      throw new Error('El aforo (SFR) debe ser mayor que B1 y mayor que B2');
    }
  }
  var headers = AFOROS_HEADERS;
  var iso = String(fechaISO || '').trim();
  var anioAuto = iso ? Number(iso.slice(0, 4)) : new Date().getFullYear();
  var fechaAuto = fechaDisplayAforo_(iso) || fechaDisplayAforo_(Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd'));
  var semanaAuto = isoWeekAforo_(iso);
  if (semanaAuto === '' || semanaAuto == null) {
    semanaAuto = isoWeekAforo_(Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd'));
  }
  var hora = horaGuardada || formatHoraGuardada_(new Date());
  var reg = splitRegador_(data.evaluador || data.regador || '');
  // ETo / lámina: un valor del formulario → se copia a TODAS las filas
  var etoGlobal = data.eto !== '' && data.eto != null ? data.eto : '';
  var laminaGlobal = data.lamina !== '' && data.lamina != null ? data.lamina : '';
  var matrix = [];
  for (var i = 0; i < list.length; i++) {
    var r = list[i] || {};
    var aforo = Number(r.aforo) || 0;
    var b1 = Number(r.drenaje1) || 0;
    var b2 = Number(r.drenaje2) || 0;
    var modulo = String(r.modulo || data.modulo || '').trim().toUpperCase();
    if (modulo && modulo.charAt(0) !== 'M') modulo = 'M' + String(modulo).replace(/\D/g, '');
    var turno = r.turno != null && r.turno !== '' ? Number(r.turno) : '';
    var eto = etoGlobal !== '' ? etoGlobal : (r.eto !== '' && r.eto != null ? r.eto : '');
    var lamina = laminaGlobal !== '' ? laminaGlobal : (r.lamina !== '' && r.lamina != null ? r.lamina : '');
    var loteRaw = r.lote || r.codLote || '';
    var loteN = String(loteRaw).replace(/\D/g, '');
    var valvular = r.valvula !== '' && r.valvula != null
      ? r.valvula
      : (r.valvular !== '' && r.valvular != null
        ? r.valvular
        : lookupValvular_(modulo, turno, loteRaw));
    // Lotes ENSAYO → celda "80(ENSAYO)" / "84(ENSAYO)"
    var ensCell = ensayoLabel_(loteN) || ensayoLabel_(valvular);
    if (ensCell) valvular = ensCell;
    var variedad = r.variedad || data.variedad || '';
    var fundo = r.fundo || data.fundo || '';
    var rowMap = {
      'AÑO': anioAuto,
      'FECHA': fechaAuto,
      'SEMANA': semanaAuto,
      'FUNDO': fundo,
      'VARIEDAD': variedad,
      'MÓDULO': modulo,
      'TURNO': turno,
      'VALVULAR': valvular,
      'UBICACIÓN': 'MEDIO',
      'ETo mm/día': eto === '' || eto == null ? '' : Number(eto),
      'LAMINA (mm)': lamina === '' || lamina == null ? '' : Number(lamina),
      'REPOSICION mm': '',
      'CANTIDAD DRENAJE 1': b1,
      'CANTIDAD DRENAJE 2': b2,
      'CANTIDAD AFORO': aforo,
      '% DRENAJE REAL': '',
      '%MINIMO': 0.2,
      '%MAXIMO': 0.3,
      'STATUS': '',
      'FORM.': '',
      'HORA GUARDADA': hora,
      'DNI': reg.dni,
      'REGADOR': reg.nombre
    };
    matrix.push(headers.map(function (h) {
      return rowMap.hasOwnProperty(h) ? rowMap[h] : '';
    }));
  }
  return matrix;
}

/** REPOSICION = LÁMINA/ETo · % = (B1+B2)/2/AFORO · FORM. = T{turno} - {módulo} */
function applyAforoFormulas_(sheet, startRow, nRows) {
  if (!nRows) return;
  var headers = getHeaders_(sheet);
  if (!headers.length) headers = AFOROS_HEADERS;
  var col = function (name) { return aforoHeaderIndex_(headers, name); };
  var cMod = col('MÓDULO');
  var cTur = col('TURNO');
  var cEto = col('ETo mm/día');
  var cLam = col('LAMINA (mm)');
  var cRep = col('REPOSICION mm');
  var cB1 = col('CANTIDAD DRENAJE 1');
  var cB2 = col('CANTIDAD DRENAJE 2');
  var cAf = col('CANTIDAD AFORO');
  var cPct = col('% DRENAJE REAL');
  var cMin = col('%MINIMO');
  var cMax = col('%MAXIMO');
  var cForm = col('FORM.');

  var repos = [];
  var pct = [];
  var form = [];
  for (var i = 0; i < nRows; i++) {
    var r = startRow + i;
    if (cRep > 0 && cEto > 0 && cLam > 0) {
      var eL = colLetter_(cEto) + r;
      var lL = colLetter_(cLam) + r;
      repos.push(['=IF(OR(' + eL + '="",' + lL + '=""),"",' + lL + '/' + eL + ')']);
    } else {
      repos.push(['']);
    }
    if (cPct > 0 && cAf > 0 && cB1 > 0 && cB2 > 0) {
      var aL = colLetter_(cAf) + r;
      var b1L = colLetter_(cB1) + r;
      var b2L = colLetter_(cB2) + r;
      pct.push(['=IF(OR(' + aL + '="",' + aL + '=0),"",(' + b1L + '+' + b2L + ')/2/' + aL + ')']);
    } else {
      pct.push(['']);
    }
    if (cForm > 0 && cTur > 0 && cMod > 0) {
      form.push(['="T"&' + colLetter_(cTur) + r + '&" - "&' + colLetter_(cMod) + r]);
    } else {
      form.push(['']);
    }
  }
  if (cRep > 0) {
    sheet.getRange(startRow, cRep, nRows, 1).setFormulas(repos);
    sheet.getRange(startRow, cRep, nRows, 1).setNumberFormat('0.00');
  }
  if (cPct > 0) {
    sheet.getRange(startRow, cPct, nRows, 1).setFormulas(pct);
    sheet.getRange(startRow, cPct, nRows, 1).setNumberFormat('0%');
  }
  if (cForm > 0) sheet.getRange(startRow, cForm, nRows, 1).setFormulas(form);
  if (cMin > 0) sheet.getRange(startRow, cMin, nRows, 1).setNumberFormat('0%');
  if (cMax > 0) sheet.getRange(startRow, cMax, nRows, 1).setNumberFormat('0%');
}

function styleAforoRows_(sheet, startRow, nRows) {
  if (!nRows) return;
  var headers = getHeaders_(sheet);
  if (!headers.length) headers = AFOROS_HEADERS;
  var col = function (name) { return aforoHeaderIndex_(headers, name); };
  var cFecha = col('FECHA');
  var cMod = col('MÓDULO');
  var cEto = col('ETo mm/día');
  var cLam = col('LAMINA (mm)');
  var cPct = col('% DRENAJE REAL');

  if (cFecha > 0) sheet.getRange(startRow, cFecha, nRows, 1).setBackground(AFORO_COLORS.fecha);
  if (cEto > 0) sheet.getRange(startRow, cEto, nRows, 1).setBackground(AFORO_COLORS.eto);
  if (cLam > 0) sheet.getRange(startRow, cLam, nRows, 1).setBackground(AFORO_COLORS.lamina);
  if (cPct > 0) sheet.getRange(startRow, cPct, nRows, 1).setBackground(AFORO_COLORS.pctReal);
  if (cMod > 0) {
    for (var i = 0; i < nRows; i++) {
      var cell = sheet.getRange(startRow + i, cMod);
      var mod = String(cell.getValue() || '').trim().toUpperCase();
      cell.setBackground(AFORO_COLORS.modulo[mod] || '#FFFFFF');
    }
  }
}

function fechaKey_(value) {
  if (value === '' || value == null) return '';
  if (typeof value === 'number' && isFinite(value)) {
    var epoch = new Date(Date.UTC(1899, 11, 30));
    var asDate = new Date(epoch.getTime() + Math.floor(value) * 86400000);
    return Utilities.formatDate(asDate, 'America/Lima', 'yyyy-MM-dd');
  }
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, 'America/Lima', 'yyyy-MM-dd');
  }
  var s = String(value).trim();
  if (!s) return '';
  var mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (mIso) return mIso[1] + '-' + mIso[2] + '-' + mIso[3];
  var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m) {
    var dd = ('0' + m[1]).slice(-2);
    var mm = ('0' + m[2]).slice(-2);
    return m[3] + '-' + mm + '-' + dd;
  }
  var d = new Date(s);
  if (!isNaN(d.getTime())) return Utilities.formatDate(d, 'America/Lima', 'yyyy-MM-dd');
  return '';
}

function canonFechaSave_(rawFecha, submittedAt) {
  var s = String(rawFecha || '').trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  var fromClient = fechaKey_(rawFecha);
  if (fromClient) return fromClient;
  var fromSubmit = fechaKey_(submittedAt);
  if (fromSubmit) return fromSubmit;
  return Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd');
}

function normalizeAforoType_(type) {
  var t = String(type || '').trim().toLowerCase();
  if (t === 'aforos' || t === 'licapa_i' || t === 'licapa_ii') return t;
  return '';
}

function enrichAforoRowsFundo_(rows) {
  var list = rows || [];
  for (var i = 0; i < list.length; i++) {
    var r = list[i] || {};
    var sheet = classifyAforoRowSheet_(r);
    if (sheet === SHEET_LICAPA_I || sheet === SHEET_LICAPA_II) {
      r.fundo = normalizeFundoLabel_(sheet);
      if (!r.variedad) {
        r.variedad = sheet === SHEET_LICAPA_II ? 'MAGICA' : 'SEKOYA POP';
      }
    }
    list[i] = r;
  }
  return list;
}

function writeAforoMatrixToSheet_(sheet, matrix) {
  if (!matrix || !matrix.length) return { row: 0, rowsWritten: 0 };
  var startRow = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(startRow, 1, matrix.length, AFOROS_HEADERS.length).setValues(matrix);
  applyAforoFormulas_(sheet, startRow, matrix.length);
  styleAforoRows_(sheet, startRow, matrix.length);
  return { row: startRow, rowsWritten: matrix.length };
}

function appendAforos_(ss, body, clientId, stamp) {
  var data = body.data || {};
  var type = normalizeAforoType_(body.type);
  var fechaISO = canonFechaSave_(data.fecha, body.submittedAt || stamp) ||
    Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd');
  data.fecha = fechaISO;
  if (!data.ubicacion) data.ubicacion = 'MEDIO';
  data.aforo_rows = enrichAforoRowsFundo_(data.aforo_rows || []);

  var hora = formatHoraGuardada_(body.submittedAt || stamp);
  var rowsI = [];
  var rowsII = [];
  var list = data.aforo_rows;
  for (var i = 0; i < list.length; i++) {
    var r = list[i] || {};
    var dest = classifyAforoRowSheet_(r);
    if (!dest && type === 'licapa_i') dest = SHEET_LICAPA_I;
    if (!dest && type === 'licapa_ii') dest = SHEET_LICAPA_II;
    if (dest === SHEET_LICAPA_I) rowsI.push(r);
    else if (dest === SHEET_LICAPA_II) rowsII.push(r);
    else {
      // fallback: variedad/fundo globales del payload
      var fallback = resolveAforoSheetName_(data, type || body.sheet);
      if (fallback === SHEET_LICAPA_I) rowsI.push(r);
      else if (fallback === SHEET_LICAPA_II) rowsII.push(r);
      else throw new Error('No se pudo clasificar fila (Licapa I / Licapa II)');
    }
  }
  if (!rowsI.length && !rowsII.length) throw new Error('Sin filas de aforo (aforo_rows)');

  var sheetsWritten = [];
  var totalRows = 0;
  var firstRow = 0;

  if (rowsI.length) {
    var dataI = Object.assign({}, data, {
      fundo: 'LICAPA',
      variedad: 'SEKOYA POP',
      aforo_rows: rowsI
    });
    var sheetI = getOrCreateAforoSheet_(ss, SHEET_LICAPA_I);
    var matrixI = buildAforoMatrix_(dataI, fechaISO, hora);
    var wI = writeAforoMatrixToSheet_(sheetI, matrixI);
    sheetsWritten.push(SHEET_LICAPA_I);
    totalRows += wI.rowsWritten;
    if (!firstRow) firstRow = wI.row;
  }
  if (rowsII.length) {
    var dataII = Object.assign({}, data, {
      fundo: 'LICAPA II',
      variedad: 'MAGICA',
      aforo_rows: rowsII
    });
    var sheetII = getOrCreateAforoSheet_(ss, SHEET_LICAPA_II);
    var matrixII = buildAforoMatrix_(dataII, fechaISO, hora);
    var wII = writeAforoMatrixToSheet_(sheetII, matrixII);
    sheetsWritten.push(SHEET_LICAPA_II);
    totalRows += wII.rowsWritten;
    if (!firstRow) firstRow = wII.row;
  }

  markClientIdDone_(clientId);
  return {
    ok: true,
    created: true,
    duplicate: false,
    sheet: sheetsWritten.join(' + '),
    sheets: sheetsWritten,
    row: firstRow,
    rowsWritten: totalRows,
    clientId: clientId,
    fecha: fechaISO
  };
}

function appendOneEvaluation_(ss, body) {
  body = body || {};
  var type = normalizeAforoType_(body.type);
  if (!type) throw new Error('Solo se acepta type=aforos');

  var clientId = String(body.clientId || '').trim();
  if (!clientId) throw new Error('Falta clientId (idempotencia)');

  if (isDuplicateClient_(clientId)) {
    return { ok: true, created: false, duplicate: true, clientId: clientId };
  }

  return appendAforos_(ss, body, clientId, new Date());
}

function saveEvaluation_(body) {
  var clientId = String((body && body.clientId) || '').trim();
  if (!clientId) throw new Error('Falta clientId (idempotencia)');

  var lock = LockService.getScriptLock();
  var got = false;
  try {
    got = lock.tryLock(20000);
    if (!got) throw new Error('El servidor está ocupado. Intente de nuevo.');
    var result = appendOneEvaluation_(SpreadsheetApp.getActiveSpreadsheet(), body);
    result.api = 'riego';
    return result;
  } finally {
    if (got) {
      try { lock.releaseLock(); } catch (_) {}
    }
  }
}

function saveBatch_(body) {
  body = body || {};
  var records = body.records;
  if (!records || !records.length) throw new Error('Faltan records');
  if (records.length > 10) records = records.slice(0, 10);

  var lock = LockService.getScriptLock();
  var got = false;
  try {
    got = lock.tryLock(20000);
    if (!got) throw new Error('El servidor está ocupado. Intente de nuevo.');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stamp = new Date();
    var byCid = {};

    for (var i = 0; i < records.length; i++) {
      var rec = records[i] || {};
      var cid = String(rec.clientId || '').trim();
      if (!cid) {
        byCid['idx_' + i] = { clientId: 'idx_' + i, ok: false, error: 'Falta clientId' };
        continue;
      }
      if (isDuplicateClient_(cid)) {
        byCid[cid] = { clientId: cid, ok: true, created: false, duplicate: true };
        continue;
      }
      if (!normalizeAforoType_(rec.type)) {
        byCid[cid] = { clientId: cid, ok: false, error: 'Solo se acepta type=aforos' };
        continue;
      }
      try {
        byCid[cid] = appendAforos_(ss, rec, cid, stamp);
      } catch (errA) {
        byCid[cid] = {
          clientId: cid,
          ok: false,
          error: String(errA && errA.message ? errA.message : errA).replace(/^Error:\s*/i, '')
        };
      }
    }

    var results = [];
    for (var r = 0; r < records.length; r++) {
      var cidR = String((records[r] && records[r].clientId) || '').trim() || ('idx_' + r);
      results.push(byCid[cidR] || { clientId: cidR, ok: false, error: 'sin resultado' });
    }
    return { ok: true, api: 'riego', action: 'batchSave', results: results };
  } finally {
    if (got) {
      try { lock.releaseLock(); } catch (_) {}
    }
  }
}

function doGet(e) {
  e = e || { parameter: {} };
  var action = String((e.parameter || {}).action || 'ping').trim();
  if (action === 'ping' || action === 'help') {
    return json_({
      ok: true,
      api: 'riego',
      version: '1.1.0',
      sheets: [SHEET_LICAPA_I, SHEET_LICAPA_II],
      ts: nowIso_()
    });
  }
  return json_({ ok: true, api: 'riego', sheets: [SHEET_LICAPA_I, SHEET_LICAPA_II] });
}

function doPost(e) {
  try {
    var body = parseBody_(e);
    var action = String(body.action || 'save').trim();
    if (action === 'ping') {
      return json_({ ok: true, api: 'riego', ts: nowIso_() });
    }
    if (action === 'batchSave' || action === 'batch') {
      return json_(saveBatch_(body));
    }
    return json_(saveEvaluation_(body));
  } catch (err) {
    var msg = String(err && err.message ? err.message : err).replace(/^Error:\s*/i, '');
    return json_({ ok: false, error: msg });
  }
}

function clientIdKey_(clientId) {
  return 'qbriego:' + String(clientId || '').trim();
}

function isDuplicateClient_(clientId) {
  var id = String(clientId || '').trim();
  if (!id) return false;
  var key = clientIdKey_(id);
  // 1) Caché rápida (segundos)
  try {
    if (CacheService.getScriptCache().get(key)) return true;
  } catch (_) {}
  // 2) Properties durable (días) — evita duplicados si el celular reintenta tarde
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(key);
    if (raw) {
      var ts = Number(raw);
      if (!isFinite(ts) || Date.now() - ts <= CLIENT_ID_PROP_TTL_MS) {
        // refrescar caché rápida
        try {
          CacheService.getScriptCache().put(key, '1', CACHE_TTL_SEC);
        } catch (_c) {}
        return true;
      }
      // vencido → limpiar
      try {
        PropertiesService.getScriptProperties().deleteProperty(key);
      } catch (_d) {}
    }
  } catch (_) {}
  return false;
}

function markClientIdDone_(clientId) {
  var id = String(clientId || '').trim();
  if (!id) return;
  var key = clientIdKey_(id);
  var now = String(Date.now());
  try {
    CacheService.getScriptCache().put(key, '1', CACHE_TTL_SEC);
  } catch (_) {}
  try {
    PropertiesService.getScriptProperties().setProperty(key, now);
  } catch (_) {}
}

function parseBody_(e) {
  var raw = '';
  if (e && e.postData && e.postData.contents != null) {
    raw = String(e.postData.contents);
  }
  raw = String(raw || '').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    var m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch (ignore) {}
    }
    return {};
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function nowIso_() {
  return new Date().toISOString();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('APP RIEGO')
    .addItem('Preparar hojas LICAPA / LICAPA II', 'setupAforos')
    .addToUi();
}
