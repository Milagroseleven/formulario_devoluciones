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
const SHEET_AUTORIZACIONES = 'Autorizaciones';

const EMPRESA = 'Sanchoyjote S.L.';
const NIF = 'B72770191';

// Días que vale un código desde que se crea.
const DIAS_VALIDEZ_CODIGO = 30;

// Alfabeto sin caracteres que se confunden al dictarlos por teléfono
// (nada de O/0 ni I/1).
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

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
const ESTADO_DENEGADA = 'Devolución denegada';
const ESTADOS = [ESTADO_PENDIENTE, ESTADO_EFECTUADA, ESTADO_DENEGADA];

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
  'Matrícula',
  'Comercial',
  'Motivo de la devolución',
  'Detalle del motivo',
  'Número de cuenta (IBAN)',
  'Certificado de titularidad (Drive)',
  COL_ESTADO_NOMBRE,
  COL_FECHA_NOMBRE,
  COL_IMPORTE_NOMBRE,
  COL_JUSTIFICANTE_NOMBRE,
  // Estas dos van al final a propósito: así las columnas que ya tienen
  // datos en la hoja no se mueven de sitio.
  'Código de autorización',
  'Autorizado por',
];

// Cabeceras de la pestaña de autorizaciones.
const HEADERS_AUTORIZACIONES = [
  'Código',
  'Matrícula',
  'Cliente',
  'Autorizado por',
  'Fecha de creación',
  'Caduca',
  'Usado por solicitud',
  'Fecha de uso',
];

const AUT_COL_CODIGO = 1;
const AUT_COL_MATRICULA = 2;
const AUT_COL_CADUCA = 6;
const AUT_COL_USADO = 7;
const AUT_COL_FECHA_USO = 8;

// Posiciones (1 = columna A) de las columnas de seguimiento.
const COL_ESTADO = HEADERS.indexOf(COL_ESTADO_NOMBRE) + 1;
const COL_FECHA = HEADERS.indexOf(COL_FECHA_NOMBRE) + 1;
const COL_IMPORTE = HEADERS.indexOf(COL_IMPORTE_NOMBRE) + 1;
const COL_JUSTIFICANTE = HEADERS.indexOf(COL_JUSTIFICANTE_NOMBRE) + 1;

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

/**
 * Escribe (o reescribe) la fila de cabeceras. Se puede llamar sobre una
 * hoja que ya tiene datos: la fila 1 es solo texto, así que actualizarla
 * no toca ninguna solicitud.
 */
function escribirCabeceras_(sheet, cabeceras) {
  sheet.getRange(1, 1, 1, cabeceras.length)
    .setValues([cabeceras])
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
}

/** Devuelve la pestaña de solicitudes, creándola con cabeceras. */
function getHojaSolicitudes_() {
  const libro = getLibro_();
  let sheet = libro.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = libro.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    escribirCabeceras_(sheet, HEADERS);
    sheet.autoResizeColumns(1, HEADERS.length);
    prepararSeguimiento_(sheet);
  }
  return sheet;
}

/** Devuelve la pestaña de autorizaciones, creándola si no existe. */
function getHojaAutorizaciones_() {
  const libro = getLibro_();
  let sheet = libro.getSheetByName(SHEET_AUTORIZACIONES);
  if (!sheet) {
    sheet = libro.insertSheet(SHEET_AUTORIZACIONES);
  }
  if (sheet.getLastRow() === 0) {
    escribirCabeceras_(sheet, HEADERS_AUTORIZACIONES);
    sheet.getRange(2, AUT_COL_CADUCA, 5000, 1).setNumberFormat('dd/mm/yyyy');
    sheet.autoResizeColumns(1, HEADERS_AUTORIZACIONES.length);
  }
  return sheet;
}

/**
 * Deja listas las columnas de seguimiento: desplegables, formato de fecha
 * y formato de importe. Se aplica de golpe hasta FILAS_PREPARADAS para que
 * las solicitudes nuevas ya lleguen con todo puesto.
 */
function prepararSeguimiento_(sheet) {
  const filas = FILAS_PREPARADAS - 1;

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
    .addItem('Crear código de autorización', 'crearCodigoAutorizacion')
    .addSeparator()
    .addItem('Preparar columnas de seguimiento', 'configurarHoja')
    .addItem('Revisar devoluciones incompletas', 'revisarTodo')
    .addToUi();
}

/** Se ejecuta a mano desde el menú, o una sola vez tras instalar. */
function configurarHoja() {
  const sheet = getHojaSolicitudes_();
  escribirCabeceras_(sheet, HEADERS);
  prepararSeguimiento_(sheet);
  getHojaAutorizaciones_();
  revisarTodo();
  sheet.getParent().toast('Columnas de seguimiento preparadas.', 'Devoluciones', 5);
}

// ---------------------------------------------------------------------
// CÓDIGOS DE AUTORIZACIÓN
//
// El formulario es público, así que sin código no se puede solicitar una
// devolución. El código lo crea desde este menú una de las personas
// autorizadas, va ligado a una matrícula concreta, caduca y solo sirve
// una vez. Así queda registrado quién autorizó cada devolución.
// ---------------------------------------------------------------------

function nuevoCodigo_() {
  let sufijo = '';
  for (let i = 0; i < 6; i++) {
    sufijo += ALFABETO_CODIGO.charAt(Math.floor(Math.random() * ALFABETO_CODIGO.length));
  }
  return 'AUT-' + sufijo;
}

/** Se ejecuta desde el menú de la hoja. Pide matrícula y cliente. */
function crearCodigoAutorizacion() {
  const ui = SpreadsheetApp.getUi();

  const pMatricula = ui.prompt(
    'Nuevo código de autorización',
    'Matrícula de la moto (por ejemplo 3720 KDV):',
    ui.ButtonSet.OK_CANCEL);
  if (pMatricula.getSelectedButton() !== ui.Button.OK) return;

  const matricula = normalizarMatricula_(pMatricula.getResponseText());
  if (!matriculaValida_(matricula)) {
    ui.alert(AVISO_MATRICULA);
    return;
  }

  const pCliente = ui.prompt(
    'Nuevo código de autorización',
    'Nombre del cliente al que se le entrega el código:',
    ui.ButtonSet.OK_CANCEL);
  if (pCliente.getSelectedButton() !== ui.Button.OK) return;

  const cliente = pCliente.getResponseText().trim();
  if (!cliente) {
    ui.alert('Hay que indicar el nombre del cliente.');
    return;
  }

  const ahora = new Date();
  const caduca = new Date(ahora.getTime() + DIAS_VALIDEZ_CODIGO * 24 * 60 * 60 * 1000);
  const codigo = nuevoCodigo_();
  const autorizadoPor = Session.getActiveUser().getEmail() || '(sin identificar)';

  getHojaAutorizaciones_().appendRow([
    codigo, matricula, cliente, autorizadoPor, ahora, caduca, '', '',
  ]);

  const caducaTexto = Utilities.formatDate(caduca, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  ui.alert(
    'Código creado',
    'Código: ' + codigo + '\n\n' +
    'Matrícula: ' + matricula + '\n' +
    'Cliente: ' + cliente + '\n' +
    'Válido hasta: ' + caducaTexto + '\n\n' +
    'Pásaselo al cliente junto con el enlace del formulario. Solo sirve ' +
    'una vez y solo para esta matrícula.',
    ui.ButtonSet.OK);
}

/**
 * Busca un código y dice si sirve. Devuelve la fila (1 = cabecera) para
 * poder marcarla como usada después.
 * Estados posibles: 'ok', 'noExiste', 'usado', 'caducado'.
 */
function buscarCodigo_(codigo) {
  const limpio = String(codigo || '').trim().toUpperCase();
  if (!limpio) return { estado: 'noExiste' };

  const sheet = getHojaAutorizaciones_();
  const ultima = sheet.getLastRow();
  if (ultima < 2) return { estado: 'noExiste' };

  const datos = sheet.getRange(2, 1, ultima - 1, HEADERS_AUTORIZACIONES.length).getValues();
  for (let i = 0; i < datos.length; i++) {
    if (String(datos[i][AUT_COL_CODIGO - 1]).trim().toUpperCase() !== limpio) continue;

    const fila = i + 2;
    const matricula = String(datos[i][AUT_COL_MATRICULA - 1]).trim().toUpperCase();
    if (datos[i][AUT_COL_USADO - 1]) return { estado: 'usado', fila: fila, matricula: matricula };

    const caduca = datos[i][AUT_COL_CADUCA - 1];
    if (caduca instanceof Date && caduca.getTime() < Date.now()) {
      return { estado: 'caducado', fila: fila, matricula: matricula };
    }
    return { estado: 'ok', fila: fila, matricula: matricula, autorizadoPor: String(datos[i][3] || '') };
  }
  return { estado: 'noExiste' };
}

const AVISO_CODIGO = {
  noExiste: 'Ese código de autorización no existe. Revísalo con la persona de ' +
    EMPRESA + ' que te lo facilitó.',
  usado: 'Ese código ya se ha utilizado en una solicitud anterior.',
  caducado: 'Ese código ha caducado. Pide uno nuevo.',
};

/**
 * La llama el formulario en cuanto el cliente escribe el código, para
 * avisarle antes de que rellene todo lo demás.
 */
function verificarCodigo(codigo) {
  const r = buscarCodigo_(codigo);
  if (r.estado === 'ok') {
    return { ok: true, matricula: r.matricula };
  }
  return { ok: false, mensaje: AVISO_CODIGO[r.estado] };
}

/**
 * Marca en rojo, en toda la hoja, lo que falte por rellenar en las
 * devoluciones ya marcadas como efectuadas.
 */
function revisarTodo() {
  const sheet = getHojaSolicitudes_();
  const ultima = sheet.getLastRow();
  let incompletas = 0;
  for (let fila = 2; fila <= ultima; fila++) {
    if (revisarFila_(sheet, fila)) incompletas++;
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
function revisarFila_(sheet, fila) {
  const estado = sheet.getRange(fila, COL_ESTADO).getValue();
  const columnas = [COL_FECHA, COL_IMPORTE, COL_JUSTIFICANTE];
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
  if ([COL_ESTADO, COL_FECHA, COL_IMPORTE, COL_JUSTIFICANTE].indexOf(columna) === -1) return;

  const faltan = revisarFila_(sheet, fila);
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
 * data: {codigo, nombre, telefono, correo, fechaReserva, modalidad, modelo,
 *        matricula, comercial, motivo, detalleMotivo, iban,
 *        fileBase64, fileMimeType, fileName}
 *
 * Se vuelve a validar todo aquí aunque el formulario ya lo haya hecho: la
 * página es pública y lo que llega del navegador no es de fiar.
 *
 * El código de autorización se comprueba y se marca como usado dentro de
 * un candado, para que dos envíos a la vez no puedan gastar el mismo.
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
  const codigo = String(data.codigo || '').trim().toUpperCase();

  if (!codigo) throw new Error('Falta el código de autorización.');
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

  // A partir de aquí se toca el código de autorización, así que solo puede
  // haber un envío a la vez.
  const candado = LockService.getScriptLock();
  try {
    candado.waitLock(20000);
  } catch (err) {
    throw new Error('Hay otra solicitud en curso. Espera unos segundos y vuelve a enviar.');
  }

  try {
    const autorizacion = buscarCodigo_(codigo);
    if (autorizacion.estado !== 'ok') {
      throw new Error(AVISO_CODIGO[autorizacion.estado]);
    }
    if (autorizacion.matricula !== matricula) {
      throw new Error('Ese código de autorización es para la matrícula ' +
        autorizacion.matricula + ', no para la que has indicado.');
    }

    const nombreArchivo = sanitize_([
      matricula,
      'Certificado titularidad',
      nombre,
      id,
    ].join(' - ')) + extensionDe_(data.fileMimeType, data.fileName);

    const decoded = Utilities.base64Decode(data.fileBase64);
    const blob = Utilities.newBlob(decoded, data.fileMimeType, nombreArchivo);
    const fileUrl = getCarpeta_().createFile(blob).getUrl();

    getHojaSolicitudes_().appendRow([
      ahora,
      id,
      nombre,
      telefono,
      correo,
      data.fechaReserva,
      data.modalidad,
      modelo,
      matricula,
      comercial,
      data.motivo,
      detalleMotivo,
      iban,
      fileUrl,
      ESTADO_PENDIENTE,
      '',
      '',
      '',
      codigo,
      autorizacion.autorizadoPor,
    ]);

    // El código queda gastado solo si todo lo anterior ha salido bien.
    const hojaAut = getHojaAutorizaciones_();
    hojaAut.getRange(autorizacion.fila, AUT_COL_USADO).setValue(id);
    hojaAut.getRange(autorizacion.fila, AUT_COL_FECHA_USO).setValue(ahora);
  } finally {
    candado.releaseLock();
  }

  return { id: id };
}
