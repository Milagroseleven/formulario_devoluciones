/**
 * Solicitud de devolución de reserva de moto.
 *
 * Formulario web pensado para que lo rellene el propio cliente desde el
 * móvil: se le envía el enlace y él registra su solicitud. Cada envío deja
 * una fila en el Sheet y sube el certificado de titularidad a Drive.
 *
 * A diferencia del formulario de caja, aquí quien escribe es una persona
 * externa a la empresa, así que el formulario es público (sin login) y
 * todos los textos están redactados para el cliente.
 *
 * Las cuatro últimas columnas de la hoja no las rellena el cliente: son el
 * seguimiento interno que lleva el encargado a mano (ver SEGUIMIENTO).
 */

// ---------------------------------------------------------------------
// CONFIGURACIÓN
//
//   CARPETA_ID : ID de la carpeta de Drive donde se guardan los
//                certificados de titularidad. Si se deja vacío, se busca
//                (o se crea) una carpeta llamada CARPETA_NOMBRE en la
//                unidad de la cuenta que despliega el formulario.
//   HOJA_ID    : ID del Google Sheet que recibe las solicitudes. Si se
//                deja vacío, se usa la hoja en la que vive este script.
//
// El ID es el trozo largo de la URL:
//   carpeta -> drive.google.com/drive/folders/ESTO_ES_EL_ID
//   hoja    -> docs.google.com/spreadsheets/d/ESTO_ES_EL_ID/edit
// ---------------------------------------------------------------------
const CARPETA_ID = '1bZkD8uRUFAfH2Ua37aftVmpC7z2nDu8Q';
const CARPETA_NOMBRE = 'Devoluciones de reservas';
const HOJA_ID = '1bi7olbGvhe0rogClo0jC5PAmNgkLTPHWMXm9fOSHq2A';

const SHEET_NAME = 'Solicitudes';

const EMPRESA = 'Sanchoyjote S.L.';
const NIF = 'B72770191';

// Modalidad por la que el cliente pagó la reserva que ahora reclama.
const MODALIDADES = [
  'TPV datáfono',
  'Cash',
  'Reserva por la web',
  'Transferencia a cuenta',
  'Bizum a número de móvil',
];

// Motivos de la devolución. "Otros" obliga a especificar.
const MOTIVO_OTROS = 'Otros';
const MOTIVOS = [
  'Cancelación de financiación',
  'Desistimiento',
  'Motivos personales',
  MOTIVO_OTROS,
];

// Tipos de archivo admitidos para el certificado de titularidad.
const MIME_ADMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'];
const TAMANO_MAXIMO_MB = 10;

// Formatos de matrícula admitidos (igual que en el formulario de caja):
// "3720 KDV" (formato actual), "A 108859" / "M 8214 YV" / "C 2107 BWM"
// (formatos con letra de provincia, con o sin letras al final), cada uno
// con un número de unidad opcional al final ("3720 KDV 2") para cuando
// varias motos comparten matrícula.
const RE_MATRICULA = /^(\d{4} [A-Z]{3}|[A-Z]{1,2} \d{4,6}( [A-Z]{1,3})?)( \d{1,2})?$/;
const AVISO_MATRICULA = 'La matrícula no parece válida. Formatos admitidos: ' +
  '3720 KDV, A 108859, M 8214 YV, C 2107 BWM (con el número de unidad al ' +
  'final si hace falta, por ejemplo "3720 KDV 2").';

// ---------------------------------------------------------------------
// SEGUIMIENTO INTERNO (las cuatro últimas columnas)
//
// Toda solicitud nace en "Pendiente". Cuando el encargado la pasa a
// "Devolución efectuada", las tres columnas siguientes dejan de ser
// opcionales: onEdit las marca en rojo y avisa hasta que estén rellenas.
// ---------------------------------------------------------------------
const ESTADO_PENDIENTE = 'Pendiente';
const ESTADO_EFECTUADA = 'Devolución efectuada';
const ESTADOS = [ESTADO_PENDIENTE, ESTADO_EFECTUADA];

const JUSTIFICANTE_OPCIONES = ['Ok', 'Pendiente'];

const COL_ESTADO_NOMBRE = 'Estado devolución';
const COL_FECHA_NOMBRE = 'Fecha transferencia';
const COL_IMPORTE_NOMBRE = 'Importe';
const COL_JUSTIFICANTE_NOMBRE = 'Justificante enviado al comercial';

const HEADERS = [
  'Fecha registro',
  'ID solicitud',
  'Nombre y apellidos',
  'Teléfono de contacto',
  'Correo electrónico',
  'Fecha de la reserva',
  'Modalidad de reserva',
  'Modelo de la moto',
  'Matrícula o código',
  'Comercial',
  'Motivo de la devolución',
  'Detalle del motivo',
  'Número de cuenta (IBAN)',
  'Certificado de titularidad (Drive)',
  COL_ESTADO_NOMBRE,
  COL_FECHA_NOMBRE,
  COL_IMPORTE_NOMBRE,
  COL_JUSTIFICANTE_NOMBRE,
];

const FONDO_FALTA = '#fde8e8';
const NOTA_FALTA = 'Obligatorio al marcar "' + ESTADO_EFECTUADA + '".';

// Hasta qué fila se dejan preparadas las listas desplegables.
const FILAS_PREPARADAS = 2000;

function doGet() {
  const t = HtmlService.createTemplateFromFile('Index');
  t.config = JSON.stringify({
    empresa: EMPRESA,
    nif: NIF,
    modalidades: MODALIDADES,
    motivos: MOTIVOS,
    motivoOtros: MOTIVO_OTROS,
    tamanoMaximoMb: TAMANO_MAXIMO_MB,
    reMatricula: RE_MATRICULA.source,
    avisoMatricula: AVISO_MATRICULA,
  });
  return t.evaluate()
    .setTitle('Solicitud de devolución de reserva')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

/** Carpeta donde van los certificados de titularidad. */
function getCarpeta_() {
  if (CARPETA_ID) {
    try {
      return DriveApp.getFolderById(CARPETA_ID);
    } catch (err) {
      throw new Error('No se pudo abrir la carpeta configurada. Revisa CARPETA_ID.');
    }
  }
  const it = DriveApp.getFoldersByName(CARPETA_NOMBRE);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(CARPETA_NOMBRE);
}

function getLibro_() {
  if (HOJA_ID) {
    try {
      return SpreadsheetApp.openById(HOJA_ID);
    } catch (err) {
      throw new Error('No se pudo abrir la hoja configurada. Revisa HOJA_ID.');
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/** Devuelve la pestaña de solicitudes, creándola con cabeceras. */
function getHojaSolicitudes_() {
  const libro = getLibro_();
  let sheet = libro.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = libro.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.autoResizeColumns(1, HEADERS.length);
    prepararSeguimiento_(sheet);
  }
  return sheet;
}

// ---------------------------------------------------------------------
// POSICIÓN DE LAS COLUMNAS
//
// El script busca cada columna por su título en la fila 1, no por su
// posición. Así se pueden insertar, mover o quitar columnas en la hoja
// (fórmulas, indicadores, lo que haga falta) sin tocar el código: mientras
// los títulos de las columnas que escribe el formulario no cambien, todo
// sigue cuadrando.
// ---------------------------------------------------------------------

/** Título de cada columna -> su número (1 = columna A). */
function posiciones_(sheet) {
  const cabeceras = sheet.getRange(1, 1, 1, sheet.getMaxColumns()).getValues()[0];
  const mapa = {};
  for (let i = 0; i < cabeceras.length; i++) {
    const titulo = String(cabeceras[i] || '').trim();
    // Si hubiera dos columnas con el mismo título, manda la primera.
    if (titulo && !(titulo in mapa)) mapa[titulo] = i + 1;
  }
  return mapa;
}

/** Como posiciones_, pero avisa claro si falta una columna esperada. */
function columnaDe_(mapa, titulo) {
  const col = mapa[titulo];
  if (!col) {
    throw new Error('No se encuentra la columna "' + titulo + '" en la fila 1 de la ' +
      'pestaña "' + SHEET_NAME + '". Si la has renombrado, hay que volver a ponerle ' +
      'el título original.');
  }
  return col;
}

/**
 * Última fila que contiene una solicitud de verdad. No se usa getLastRow()
 * porque las columnas de fórmulas pueden estar arrastradas hacia abajo
 * cientos de filas, y entonces las solicitudes nuevas se irían al final de
 * la hoja dejando un hueco enorme.
 */
function ultimaFilaConSolicitud_(sheet, colReferencia) {
  const maximo = sheet.getMaxRows();
  if (maximo < 2) return 1;
  const valores = sheet.getRange(2, colReferencia, maximo - 1, 1).getValues();
  for (let i = valores.length - 1; i >= 0; i--) {
    if (valores[i][0] !== '' && valores[i][0] !== null) return i + 2;
  }
  return 1;
}

/**
 * Copia en la fila nueva las fórmulas de la fila anterior, con su formato.
 * No hay lista de columnas que copiar: se detectan solas mirando cuáles
 * llevaban fórmula, así que añadir o quitar columnas calculadas en la hoja
 * no obliga a tocar el código.
 */
function copiarFormulas_(sheet, destino) {
  const origen = destino - 1;
  if (origen < 2) return;  // la primera solicitud no tiene de dónde copiar

  const ancho = sheet.getLastColumn();
  const formulas = sheet.getRange(origen, 1, 1, ancho).getFormulas()[0];
  for (let i = 0; i < formulas.length; i++) {
    if (!formulas[i]) continue;
    sheet.getRange(origen, i + 1).copyTo(sheet.getRange(destino, i + 1));
  }
}

/**
 * Escribe una solicitud en la primera fila libre y arrastra a esa fila las
 * fórmulas de la anterior.
 *
 * No se usa appendRow porque escribe por posición: en cuanto se inserta
 * una columna en medio de la hoja, los datos se irían a la columna
 * equivocada y pisarían lo que hubiera allí. Aquí cada valor se escribe en
 * la columna que lleva su título, y lo demás se queda como está.
 */
function escribirSolicitud_(sheet, valores) {
  const col = posiciones_(sheet);
  const destino = ultimaFilaConSolicitud_(sheet, columnaDe_(col, 'ID solicitud')) + 1;

  // Primero las fórmulas: así, si alguna calcula sobre los datos de su
  // propia fila, se recalcula sola en cuanto se escriben debajo.
  copiarFormulas_(sheet, destino);

  Object.keys(valores).forEach(function(titulo) {
    sheet.getRange(destino, columnaDe_(col, titulo)).setValue(valores[titulo]);
  });

  return destino;
}

/**
 * Deja listas las columnas de seguimiento: desplegables, formato de fecha
 * y formato de importe. Se aplica de golpe hasta FILAS_PREPARADAS para que
 * las solicitudes nuevas ya lleguen con todo puesto.
 */
function prepararSeguimiento_(sheet) {
  const filas = FILAS_PREPARADAS - 1;
  const col = posiciones_(sheet);
  const COL_ESTADO = columnaDe_(col, COL_ESTADO_NOMBRE);
  const COL_FECHA = columnaDe_(col, COL_FECHA_NOMBRE);
  const COL_IMPORTE = columnaDe_(col, COL_IMPORTE_NOMBRE);
  const COL_JUSTIFICANTE = columnaDe_(col, COL_JUSTIFICANTE_NOMBRE);

  const validacionEstado = SpreadsheetApp.newDataValidation()
    .requireValueInList(ESTADOS, true)
    .setAllowInvalid(false)
    .setHelpText('Al marcar "' + ESTADO_EFECTUADA + '" hay que rellenar la fecha, ' +
      'el importe y el justificante.')
    .build();
  sheet.getRange(2, COL_ESTADO, filas, 1).setDataValidation(validacionEstado);

  const validacionJustificante = SpreadsheetApp.newDataValidation()
    .requireValueInList(JUSTIFICANTE_OPCIONES, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, COL_JUSTIFICANTE, filas, 1).setDataValidation(validacionJustificante);

  sheet.getRange(2, COL_FECHA, filas, 1).setNumberFormat('dd/mm/yyyy');
  sheet.getRange(2, COL_IMPORTE, filas, 1).setNumberFormat('#,##0.00 €');
}

/** Menú propio de la hoja, para poder relanzar la configuración a mano. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Devoluciones')
    .addItem('Preparar columnas de seguimiento', 'configurarHoja')
    .addItem('Revisar devoluciones incompletas', 'revisarTodo')
    .addToUi();
}

/** Se ejecuta a mano desde el menú, o una sola vez tras instalar. */
function configurarHoja() {
  const sheet = getHojaSolicitudes_();
  prepararSeguimiento_(sheet);
  revisarTodo();
  sheet.getParent().toast('Columnas de seguimiento preparadas.', 'Devoluciones', 5);
}

/**
 * Marca en rojo, en toda la hoja, lo que falte por rellenar en las
 * devoluciones ya marcadas como efectuadas.
 */
function revisarTodo() {
  const sheet = getHojaSolicitudes_();
  const col = posiciones_(sheet);
  const ultima = ultimaFilaConSolicitud_(sheet, columnaDe_(col, 'ID solicitud'));
  let incompletas = 0;
  for (let fila = 2; fila <= ultima; fila++) {
    if (revisarFila_(sheet, fila, col)) incompletas++;
  }
  sheet.getParent().toast(
    incompletas === 0
      ? 'Todas las devoluciones efectuadas están completas.'
      : 'Hay ' + incompletas + ' devolución(es) efectuada(s) con datos sin rellenar.',
    'Devoluciones', 6);
}

/**
 * Revisa una fila y devuelve true si le falta algo. Las celdas que faltan
 * quedan en rojo y con una nota; las que ya están, limpias.
 */
function revisarFila_(sheet, fila, col) {
  col = col || posiciones_(sheet);
  const estado = sheet.getRange(fila, columnaDe_(col, COL_ESTADO_NOMBRE)).getValue();
  const columnas = [
    columnaDe_(col, COL_FECHA_NOMBRE),
    columnaDe_(col, COL_IMPORTE_NOMBRE),
    columnaDe_(col, COL_JUSTIFICANTE_NOMBRE),
  ];
  const exigir = estado === ESTADO_EFECTUADA;
  let faltan = 0;

  for (let i = 0; i < columnas.length; i++) {
    const celda = sheet.getRange(fila, columnas[i]);
    const vacia = celda.getValue() === '' || celda.getValue() === null;
    if (exigir && vacia) {
      celda.setBackground(FONDO_FALTA).setNote(NOTA_FALTA);
      faltan++;
    } else {
      celda.setBackground(null).clearNote();
    }
  }
  return faltan > 0;
}

/**
 * Disparador simple: salta con cada edición manual de la hoja. Solo mira
 * las cuatro columnas de seguimiento, para no ralentizar el resto.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  const fila = e.range.getRow();
  const columna = e.range.getColumn();
  if (fila < 2) return;

  const col = posiciones_(sheet);
  const vigiladas = [
    col[COL_ESTADO_NOMBRE],
    col[COL_FECHA_NOMBRE],
    col[COL_IMPORTE_NOMBRE],
    col[COL_JUSTIFICANTE_NOMBRE],
  ];
  if (vigiladas.indexOf(columna) === -1) return;

  const faltan = revisarFila_(sheet, fila, col);
  if (faltan) {
    sheet.getParent().toast(
      'Marcaste "' + ESTADO_EFECTUADA + '": faltan por rellenar los campos en rojo ' +
      '(fecha de transferencia, importe y justificante).',
      'Fila ' + fila + ' incompleta', 8);
  }
}

function sanitize_(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '-').trim();
}

function nuevoId_(fechaRegistro) {
  const dia = Utilities.formatDate(fechaRegistro, Session.getScriptTimeZone(), 'yyyyMMdd');
  const sufijo = Utilities.getUuid().replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase();
  return 'DEV-' + dia + '-' + sufijo;
}

/**
 * Deja la matrícula en mayúsculas y con un solo espacio entre bloques. Si
 * se escribió toda junta (por ejemplo "1234BCD"), separa los bloques para
 * que encaje con RE_MATRICULA.
 */
function normalizarMatricula_(valor) {
  let t = String(valor || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  if (!t || t.indexOf(' ') !== -1) return t;
  const m = t.match(/^(\d{4})([A-Z]{3})$/) || t.match(/^([A-Z]{1,2})(\d{4,6})([A-Z]{0,3})$/);
  if (!m) return t;
  return m.slice(1).filter(Boolean).join(' ');
}

function matriculaValida_(matricula) {
  return RE_MATRICULA.test(matricula);
}

/** Quita espacios y pasa a mayúsculas: así se guarda y se compara el IBAN. */
function normalizarIban_(iban) {
  return String(iban || '').replace(/\s+/g, '').toUpperCase();
}

/**
 * Validación estándar de IBAN (ISO 13616): se mueven los cuatro primeros
 * caracteres al final, cada letra se sustituye por su posición en el
 * alfabeto + 9, y el número resultante tiene que dar resto 1 al dividirlo
 * entre 97. El resto se calcula por trozos porque el número es demasiado
 * grande para un entero.
 */
function ibanValido_(iban) {
  const v = normalizarIban_(iban);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(v)) return false;
  if (v.substring(0, 2) === 'ES' && v.length !== 24) return false;

  const reordenado = v.substring(4) + v.substring(0, 4);
  let numerico = '';
  for (let i = 0; i < reordenado.length; i++) {
    const c = reordenado.charAt(i);
    numerico += (c >= 'A' && c <= 'Z') ? String(c.charCodeAt(0) - 55) : c;
  }

  let resto = 0;
  for (let i = 0; i < numerico.length; i += 7) {
    resto = Number(String(resto) + numerico.substring(i, i + 7)) % 97;
  }
  return resto === 1;
}

/** Extensión con la que se guarda el certificado en Drive. */
function extensionDe_(mimeType, nombreOriginal) {
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/heic') return '.heic';
  const punto = String(nombreOriginal || '').lastIndexOf('.');
  if (punto > -1) return String(nombreOriginal).substring(punto).toLowerCase();
  return '.jpg';
}

/**
 * data: {nombre, telefono, correo, fechaReserva, modalidad, modelo,
 *        matricula, comercial, motivo, detalleMotivo, iban,
 *        fileBase64, fileMimeType, fileName}
 *
 * Se vuelve a validar todo aquí aunque el formulario ya lo haya hecho: la
 * página es pública y lo que llega del navegador no es de fiar.
 */
function submitDevolucion(data) {
  data = data || {};

  const nombre = String(data.nombre || '').trim();
  const telefono = String(data.telefono || '').trim();
  const correo = String(data.correo || '').trim();
  const modelo = String(data.modelo || '').trim();
  const matricula = normalizarMatricula_(data.matricula);
  const comercial = String(data.comercial || '').trim();
  const detalleMotivo = String(data.detalleMotivo || '').trim();
  const iban = normalizarIban_(data.iban);

  if (!nombre) throw new Error('Falta el nombre y los apellidos.');
  if (!telefono) throw new Error('Falta el teléfono de contacto.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
    throw new Error('El correo electrónico no parece válido.');
  }
  if (!data.fechaReserva) throw new Error('Falta la fecha de la reserva.');
  if (MODALIDADES.indexOf(data.modalidad) === -1) {
    throw new Error('Falta indicar la modalidad de la reserva.');
  }
  if (!modelo) throw new Error('Falta el modelo de la moto.');
  if (!matricula) throw new Error('Falta la matrícula.');
  if (!matriculaValida_(matricula)) throw new Error(AVISO_MATRICULA);
  if (!comercial) throw new Error('Falta el nombre del comercial.');
  if (MOTIVOS.indexOf(data.motivo) === -1) {
    throw new Error('Falta indicar el motivo de la devolución.');
  }
  if (data.motivo === MOTIVO_OTROS && !detalleMotivo) {
    throw new Error('Al elegir "Otros" hay que explicar el motivo.');
  }
  if (!ibanValido_(iban)) {
    throw new Error('El número de cuenta (IBAN) no es válido. Revísalo: en España empieza por ES y tiene 24 caracteres.');
  }
  if (!data.fileBase64) {
    throw new Error('Falta adjuntar el certificado de titularidad de la cuenta.');
  }
  if (MIME_ADMITIDOS.indexOf(data.fileMimeType) === -1) {
    throw new Error('El certificado tiene que ser un PDF o una imagen.');
  }

  const ahora = new Date();
  const id = nuevoId_(ahora);

  // Cada dato va a la columna que lleve ese título, esté donde esté. Las
  // columnas que no aparecen aquí (las de fórmulas, por ejemplo) no se
  // tocan: se rellenan solas al copiar la fila anterior.
  const valores = {};
  valores['Fecha registro'] = ahora;
  valores['ID solicitud'] = id;
  valores['Nombre y apellidos'] = nombre;
  valores['Teléfono de contacto'] = telefono;
  valores['Correo electrónico'] = correo;
  valores['Fecha de la reserva'] = data.fechaReserva;
  valores['Modalidad de reserva'] = data.modalidad;
  valores['Modelo de la moto'] = modelo;
  valores['Matrícula o código'] = matricula;
  valores['Comercial'] = comercial;
  valores['Motivo de la devolución'] = data.motivo;
  valores['Detalle del motivo'] = detalleMotivo;
  valores['Número de cuenta (IBAN)'] = iban;
  valores[COL_ESTADO_NOMBRE] = ESTADO_PENDIENTE;

  const COL_CERTIFICADO_NOMBRE = 'Certificado de titularidad (Drive)';

  // Se comprueba que la hoja tiene todas esas columnas antes de subir nada
  // a Drive: si algún título no cuadra, es mejor fallar aquí que dejar el
  // certificado huérfano en la carpeta.
  const sheet = getHojaSolicitudes_();
  const col = posiciones_(sheet);
  Object.keys(valores).concat([COL_CERTIFICADO_NOMBRE]).forEach(function(titulo) {
    columnaDe_(col, titulo);
  });

  const nombreArchivo = sanitize_([
    matricula,
    'Certificado titularidad',
    nombre,
    id,
  ].join(' - ')) + extensionDe_(data.fileMimeType, data.fileName);

  const decoded = Utilities.base64Decode(data.fileBase64);
  const blob = Utilities.newBlob(decoded, data.fileMimeType, nombreArchivo);
  valores[COL_CERTIFICADO_NOMBRE] = getCarpeta_().createFile(blob).getUrl();

  escribirSolicitud_(sheet, valores);

  return { id: id };
}
