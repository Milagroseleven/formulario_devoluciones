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
 */

// ---------------------------------------------------------------------
// CONFIGURACIÓN
//
//   CARPETA_ID  : ID de la carpeta de Drive donde se guardan los
//                 certificados de titularidad. Si se deja vacío, se busca
//                 (o se crea) una carpeta llamada CARPETA_NOMBRE en la
//                 unidad de la cuenta que despliega el formulario.
//   NOTIFICAR_A : correo (o correos separados por coma) que recibe un
//                 aviso con cada solicitud. Vacío = no se envía nada.
//
// El ID es el trozo largo de la URL de la carpeta:
//   drive.google.com/drive/folders/ESTO_ES_EL_ID
// ---------------------------------------------------------------------
const CARPETA_ID = '';
const CARPETA_NOMBRE = 'Devoluciones de reservas';
const NOTIFICAR_A = '';

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
  'Importe de la reserva (EUR)',
  'Número de cuenta (IBAN)',
  'Certificado de titularidad (Drive)',
  'Estado',
];

// Valor con el que nace toda solicitud; contabilidad lo va cambiando a mano.
const ESTADO_INICIAL = 'Pendiente de revisar';

function doGet() {
  const t = HtmlService.createTemplateFromFile('Index');
  t.config = JSON.stringify({
    empresa: EMPRESA,
    nif: NIF,
    modalidades: MODALIDADES,
    motivos: MOTIVOS,
    motivoOtros: MOTIVO_OTROS,
    tamanoMaximoMb: TAMANO_MAXIMO_MB,
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

/** Devuelve la pestaña de solicitudes, creándola con cabeceras. */
function getHojaSolicitudes_() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = libro.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = libro.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS.length);
  }
  return sheet;
}

function sanitize_(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '-').trim();
}

function nuevoId_(fechaRegistro) {
  const dia = Utilities.formatDate(fechaRegistro, Session.getScriptTimeZone(), 'yyyyMMdd');
  const sufijo = Utilities.getUuid().replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase();
  return 'DEV-' + dia + '-' + sufijo;
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

/** Aviso al equipo de administración, si hay destinatario configurado. */
function avisar_(id, d) {
  if (!NOTIFICAR_A) return;
  const cuerpo = [
    'Nueva solicitud de devolución de reserva.',
    '',
    'ID: ' + id,
    'Cliente: ' + d.nombre,
    'Teléfono: ' + d.telefono,
    'Correo: ' + d.correo,
    'Reserva: ' + d.fechaReserva + ' - ' + d.modalidad,
    'Moto: ' + d.modelo + ' (' + d.matricula + ')',
    'Comercial: ' + d.comercial,
    'Motivo: ' + d.motivo + (d.detalleMotivo ? ' - ' + d.detalleMotivo : ''),
  ].join('\n');
  try {
    MailApp.sendEmail(NOTIFICAR_A, 'Devolución de reserva ' + id + ' - ' + d.nombre, cuerpo);
  } catch (err) {
    // Un fallo en el aviso no puede tumbar el registro: la fila ya está
    // guardada, que es lo que de verdad importa.
    console.error('No se pudo enviar el aviso: ' + err);
  }
}

/**
 * data: {nombre, telefono, correo, fechaReserva, modalidad, modelo,
 *        matricula, comercial, motivo, detalleMotivo, importe, iban,
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
  const matricula = String(data.matricula || '').trim().toUpperCase();
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
  if (!matricula) throw new Error('Falta la matrícula o el código.');
  if (!comercial) throw new Error('Falta el nombre del comercial.');
  if (MOTIVOS.indexOf(data.motivo) === -1) {
    throw new Error('Falta indicar el motivo de la devolución.');
  }
  if (data.motivo === MOTIVO_OTROS && !detalleMotivo) {
    throw new Error('Al elegir "Otros" hay que explicar el motivo.');
  }

  const importe = Number(data.importe);
  if (!importe || importe <= 0) {
    throw new Error('El importe de la reserva tiene que ser mayor que cero.');
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
    importe,
    iban,
    fileUrl,
    ESTADO_INICIAL,
  ]);

  avisar_(id, {
    nombre: nombre,
    telefono: telefono,
    correo: correo,
    fechaReserva: data.fechaReserva,
    modalidad: data.modalidad,
    modelo: modelo,
    matricula: matricula,
    comercial: comercial,
    motivo: data.motivo,
    detalleMotivo: detalleMotivo,
  });

  return { id: id };
}
