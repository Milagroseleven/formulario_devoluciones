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

// Este motivo decide quién tiene que validar la devolución: si la
// financiación no salió, valida Financiaciones; en cualquier otro caso,
// valida dirección. De ahí que tenga constante propia.
const MOTIVO_FINANCIACION = 'Financiación no aprobada';

// Nombre anterior del mismo motivo. Se conserva solo para que las
// solicitudes registradas antes del cambio se sigan sombreando bien.
const MOTIVO_FINANCIACION_ANTIGUO = 'Cancelación de financiación';

const MOTIVOS = [
  MOTIVO_FINANCIACION,
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
const COL_JUSTIFICANTE_NOMBRE =
  'Justificante enviado al comercial y/o al grupo de devolución de reservas';

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

// ---------------------------------------------------------------------
// COLUMNAS DE VALIDACIÓN PROTEGIDAS
//
// Cada una de estas columnas solo la pueden escribir las cuentas de su
// lista. Lo impide Google, no el script: quien no esté en la lista recibe
// un aviso y no puede escribir ahí, aunque pueda editar el resto de la
// hoja. Las listas desplegables de esas celdas las pone la hoja, no el
// código; aquí solo se aplica el bloqueo.
//
// El título se compara sin distinguir mayúsculas ni espacios de más, así
// que un encabezado escrito en dos líneas también encaja. Si aun así no se
// encuentra, el menú avisa de cuál falta en vez de bloquear otra cosa.
//
// Al cambiar estas listas hay que volver a ejecutar
// "Devoluciones -> Preparar columnas de seguimiento" para que se aplique.
//
// Ojo: estar en la lista no da acceso al Sheet. Cada cuenta necesita
// además permiso de edición sobre el archivo, o no podrá ni abrirlo.
// ---------------------------------------------------------------------
// Cuentas que entran en las dos listas: las automatizaciones y la persona
// que administra la hoja.
const CUENTAS_SIEMPRE = [
  'conciliacion-ventas@conciliacion-ventas.iam.gserviceaccount.com',
  'onboarding@motick-onboarding.iam.gserviceaccount.com',
  'milagros.gamboa@motickfamily.com',
];

const COL_VALIDACION_FINANCIACIONES = 'Aprobación Financiaciones';
const COL_VALIDACION_DIRECCION = 'Aprobación Gon / Jaime / Nacho';

const COLUMNAS_PROTEGIDAS = [
  {
    columna: COL_VALIDACION_FINANCIACIONES,
    correos: [
      'financiaciones@motickfamily.com',
    ].concat(CUENTAS_SIEMPRE),
  },
  {
    columna: COL_VALIDACION_DIRECCION,
    correos: [
      'gonzalo@motickfamily.com',
      'gonzalo.garnelo@gmail.com',
      'jaime@motickfamily.com',
      'nacho.carrion@motickfamily.com',
    ].concat(CUENTAS_SIEMPRE),
  },
];

const DESCRIPCION_PROTECCION = 'Validación restringida: ';

const FONDO_FALTA = '#fde8e8';

// Colores de las dos columnas de validación. El gris tiene que verse
// claramente más oscuro que la hoja para que lea como "casilla apagada";
// uno demasiado suave se confunde con el fondo y no se entiende nada.
const FONDO_NO_APLICA = '#c9ced3';
const FONDO_PENDIENTE = '#fce8b2';

const LEYENDA_VALIDACION =
  'Gris: esta aprobación no aplica en esa fila, según el motivo de la devolución.\n' +
  'Ámbar: es la aprobación que toca y sigue pendiente.\n' +
  'Ni gris ni ámbar: ya está aprobada.';
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
/**
 * Deja el título como texto comparable: los saltos de línea dentro de la
 * celda y los espacios de más pasan a un único espacio. Es lo que permite
 * que una cabecera escrita en dos líneas siga encontrándose.
 */
function normalizarTitulo_(titulo) {
  return String(titulo || '').replace(/\s+/g, ' ').trim();
}

/** Versión aún más suelta, para el segundo intento: sin espacios ni mayúsculas. */
function tituloSuelto_(titulo) {
  return normalizarTitulo_(titulo).toLowerCase().replace(/\s+/g, '');
}

function posiciones_(sheet) {
  const cabeceras = sheet.getRange(1, 1, 1, sheet.getMaxColumns()).getValues()[0];
  const mapa = {};
  for (let i = 0; i < cabeceras.length; i++) {
    const titulo = normalizarTitulo_(cabeceras[i]);
    // Si hubiera dos columnas con el mismo título, manda la primera.
    if (titulo && !(titulo in mapa)) mapa[titulo] = i + 1;
  }
  return mapa;
}

/**
 * Busca una columna por su título y devuelve su número, o 0 si no está.
 *
 * Primero compara el título tal cual (ya sin saltos de línea ni espacios
 * dobles). Si no aparece, lo intenta otra vez ignorando mayúsculas y todos
 * los espacios, para que "Aprobación Gon / Jaime / Nacho" y
 * "Aprobación Gon/Jaime/Nacho" cuenten como la misma columna.
 */
function buscarColumna_(mapa, titulo) {
  const exacto = mapa[normalizarTitulo_(titulo)];
  if (exacto) return exacto;

  const buscado = tituloSuelto_(titulo);
  const claves = Object.keys(mapa);
  for (let i = 0; i < claves.length; i++) {
    if (tituloSuelto_(claves[i]) === buscado) return mapa[claves[i]];
  }
  return 0;
}

/** Los títulos que hay ahora mismo en la fila 1, para poder enseñarlos. */
function titulosDeLaHoja_(sheet) {
  return Object.keys(posiciones_(sheet));
}

/** Como posiciones_, pero avisa claro si falta una columna esperada. */
function columnaDe_(mapa, titulo) {
  const col = buscarColumna_(mapa, titulo);
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

  sheet.getRange(2, columnaDe_(col, COL_FECHA_NOMBRE), filas, 1)
    .setNumberFormat('dd/mm/yyyy');
  sheet.getRange(2, columnaDe_(col, COL_IMPORTE_NOMBRE), filas, 1)
    .setNumberFormat('#,##0.00 €');
}

/**
 * Estira las listas desplegables de las columnas de validación hasta
 * FILAS_PREPARADAS.
 *
 * La lista la creaste tú sobre las filas que había en ese momento, así que
 * las solicitudes nuevas caían fuera y llegaban sin desplegable. En vez de
 * definir aquí las opciones (que serían dos sitios que mantener), se coge
 * la regla que ya está puesta en la columna y se aplica hacia abajo.
 */
function extenderListas_(sheet) {
  const col = posiciones_(sheet);
  const ultima = Math.max(ultimaFilaConSolicitud_(sheet, columnaDe_(col, 'ID solicitud')), 2);
  const estiradas = [];
  const sinLista = [];

  // Las cuatro columnas con desplegable. "opciones" solo se usa si la
  // columna no tiene ninguna lista todavía; mientras haya una puesta en la
  // hoja, manda esa, con los colores y el orden que le hayas dado.
  const conDesplegable = [
    { columna: COL_ESTADO_NOMBRE, opciones: ESTADOS },
    { columna: COL_JUSTIFICANTE_NOMBRE, opciones: JUSTIFICANTE_OPCIONES },
    { columna: COL_VALIDACION_FINANCIACIONES, opciones: null },
    { columna: COL_VALIDACION_DIRECCION, opciones: null },
  ];

  conDesplegable.forEach(function(conf) {
    const numero = buscarColumna_(col, conf.columna);
    if (!numero) return;

    // Se busca la lista que ya está puesta en la columna y se aplica hacia
    // abajo. Reutilizarla en vez de crear una nueva es lo que conserva los
    // colores de las opciones: si se creara desde el código, se perderían.
    const puestas = sheet.getRange(2, numero, ultima - 1, 1).getDataValidations();
    let modelo = null;
    for (let i = 0; i < puestas.length && !modelo; i++) modelo = puestas[i][0];

    if (!modelo && conf.opciones) {
      modelo = SpreadsheetApp.newDataValidation()
        .requireValueInList(conf.opciones, true)
        .setAllowInvalid(false)
        .build();
    }
    if (!modelo) {
      sinLista.push(conf.columna);
      return;
    }

    sheet.getRange(2, numero, FILAS_PREPARADAS - 1, 1).setDataValidation(modelo);
    estiradas.push(conf.columna);
  });

  return { estiradas: estiradas, sinLista: sinLista };
}

/** Número de columna -> letra de la hoja (1 = A, 27 = AA). */
function letraColumna_(numero) {
  let letra = '';
  while (numero > 0) {
    const resto = (numero - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    numero = Math.floor((numero - resto) / 26);
  }
  return letra;
}

/**
 * Sombrea en gris la validación que NO hace falta en cada fila, según el
 * motivo de la devolución:
 *
 *   - "Financiación no aprobada"  -> valida Financiaciones,
 *                                    se sombrea la de dirección.
 *   - cualquier otro motivo       -> valida dirección,
 *                                    se sombrea la de Financiaciones.
 *
 * Se hace con formato condicional en vez de pintando celdas desde el
 * script: así el gris aparece y desaparece solo en cuanto cambia el
 * motivo, sin esperar a que se ejecute nada.
 */
function aplicarSombreado_(sheet) {
  const col = posiciones_(sheet);
  const numeroMotivo = buscarColumna_(col, 'Motivo de la devolución');
  const numeroFinanciaciones = buscarColumna_(col, COL_VALIDACION_FINANCIACIONES);
  const numeroDireccion = buscarColumna_(col, COL_VALIDACION_DIRECCION);

  if (!numeroMotivo || !numeroFinanciaciones || !numeroDireccion) return false;

  const motivo = '$' + letraColumna_(numeroMotivo) + '2';
  const esFinanciacion = 'OR(' + motivo + '="' + MOTIVO_FINANCIACION + '";' +
    motivo + '="' + MOTIVO_FINANCIACION_ANTIGUO + '")';
  const hayMotivo = motivo + '<>""';

  // Para cada columna: cuándo se apaga (no le toca) y cuándo está
  // pendiente (le toca y todavía está vacía).
  const propiaDireccion = '$' + letraColumna_(numeroDireccion) + '2';
  const propiaFinanciaciones = '$' + letraColumna_(numeroFinanciaciones) + '2';

  const apagarDireccion = '=' + esFinanciacion;
  const pendienteDireccion = '=AND(' + hayMotivo + ';NOT(' + esFinanciacion + ');' +
    propiaDireccion + '="")';

  const apagarFinanciaciones = '=AND(' + hayMotivo + ';NOT(' + esFinanciacion + '))';
  const pendienteFinanciaciones = '=AND(' + esFinanciacion + ';' +
    propiaFinanciaciones + '="")';

  const filas = FILAS_PREPARADAS - 1;
  const rangoDireccion = sheet.getRange(2, numeroDireccion, filas, 1);
  const rangoFinanciaciones = sheet.getRange(2, numeroFinanciaciones, filas, 1);

  function regla(formula, color, rango) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(formula)
      .setBackground(color)
      .setRanges([rango])
      .build();
  }

  // El orden importa: en Sheets gana la primera regla que se cumple, y
  // "apagada" tiene que pesar más que "pendiente".
  const nuevas = [
    regla(apagarDireccion, FONDO_NO_APLICA, rangoDireccion),
    regla(pendienteDireccion, FONDO_PENDIENTE, rangoDireccion),
    regla(apagarFinanciaciones, FONDO_NO_APLICA, rangoFinanciaciones),
    regla(pendienteFinanciaciones, FONDO_PENDIENTE, rangoFinanciaciones),
  ];

  // La leyenda va en una nota sobre el título de cada columna, para que
  // los colores se puedan consultar sin preguntarle a nadie.
  sheet.getRange(1, numeroDireccion).setNote(LEYENDA_VALIDACION);
  sheet.getRange(1, numeroFinanciaciones).setNote(LEYENDA_VALIDACION);

  // Se quitan solo las reglas que ha puesto este script (se reconocen por
  // su fórmula), para no tocar el formato condicional propio de la hoja.
  const mias = [apagarDireccion, pendienteDireccion,
                apagarFinanciaciones, pendienteFinanciaciones];
  const ajenas = sheet.getConditionalFormatRules().filter(function(regla) {
    const condicion = regla.getBooleanCondition();
    if (!condicion) return true;
    const valores = condicion.getCriteriaValues() || [];
    return mias.indexOf(String(valores[0])) === -1;
  });

  sheet.setConditionalFormatRules(ajenas.concat(nuevas));
  return true;
}

/**
 * Bloquea cada columna de COLUMNAS_PROTEGIDAS para todo el mundo menos las
 * cuentas de su lista.
 *
 * Se procesa columna por columna y se recogen los fallos en vez de cortar
 * a la primera: así un título mal escrito o un correo sin acceso al
 * archivo no impide proteger las demás.
 *
 * Aviso: a la propietaria del Sheet no se la puede dejar fuera. Google
 * siempre le permite editar cualquier celda de su propio archivo.
 */
function protegerValidaciones_(sheet) {
  const col = posiciones_(sheet);
  const yo = Session.getEffectiveUser().getEmail();
  const hechas = [];
  const fallos = [];

  // Se borran de una vez todas las protecciones puestas por este script,
  // reconocidas por el principio de su descripción. Si se buscara la
  // descripción exacta, al renombrar una columna la protección vieja se
  // quedaría puesta sobre la columna antigua y acabaría habiendo dos.
  sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function(p) {
    if (String(p.getDescription() || '').indexOf(DESCRIPCION_PROTECCION) === 0) {
      p.remove();
    }
  });

  COLUMNAS_PROTEGIDAS.forEach(function(conf) {
    const numero = buscarColumna_(col, conf.columna);
    if (!numero) {
      fallos.push(conf.columna + ' (no existe esa columna en la fila 1)');
      return;
    }

    const correos = conf.correos
      .map(function(c) { return String(c || '').trim(); })
      .filter(Boolean);
    if (!correos.length) {
      fallos.push(conf.columna + ' (sin cuentas en la lista)');
      return;
    }

    try {
      const descripcion = DESCRIPCION_PROTECCION + conf.columna;
      const proteccion = sheet
        .getRange(2, numero, FILAS_PREPARADAS - 1, 1)
        .protect()
        .setDescription(descripcion);

      const sobran = proteccion.getEditors()
        .map(function(u) { return u.getEmail(); })
        .filter(function(e) { return e && e !== yo && correos.indexOf(e) === -1; });
      if (sobran.length) proteccion.removeEditors(sobran);

      proteccion.addEditors(correos);
      if (proteccion.canDomainEdit()) proteccion.setDomainEdit(false);
      hechas.push(conf.columna);
    } catch (err) {
      fallos.push(conf.columna + ' (' + err.message + ')');
    }
  });

  return { hechas: hechas, fallos: fallos };
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

  const listas = extenderListas_(sheet);
  const sombreado = aplicarSombreado_(sheet);
  const proteccion = protegerValidaciones_(sheet);
  revisarTodo();

  // Si algo no ha salido, se cuenta en una ventana en vez de en el aviso
  // pequeño de la esquina, que corta el texto justo cuando más falta hace
  // leerlo. Se listan los títulos reales de la hoja para poder comparar.
  if (proteccion.fallos.length || !sombreado || listas.sinLista.length) {
    const detalle = ['No se ha podido aplicar todo:', ''];
    proteccion.fallos.forEach(function(f) { detalle.push('  · ' + f); });
    listas.sinLista.forEach(function(c) {
      detalle.push('  · ' + c + ': no hay ninguna lista desplegable de la que ' +
        'copiar. Pon la lista en una celda de esa columna y vuelve a ejecutar esto.');
    });
    if (!sombreado) {
      detalle.push('  · Sombreado automático: falta alguna de las columnas de ' +
        'validación o la de "Motivo de la devolución".');
    }
    detalle.push('', 'Títulos que hay ahora en la fila 1:', '');
    titulosDeLaHoja_(sheet).forEach(function(t) { detalle.push('  ' + t); });
    detalle.push('', 'Copia el título tal cual de esta lista a COLUMNAS_PROTEGIDAS, ' +
      'o corrige el de la hoja.');

    SpreadsheetApp.getUi().alert('Devoluciones', detalle.join('\n'),
      SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  sheet.getParent().toast(
    'Listo. Bloqueadas y con la lista estirada: ' + proteccion.hechas.join(', ') +
    '. Sombreado aplicado.',
    'Devoluciones', 10);
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
    buscarColumna_(col, COL_ESTADO_NOMBRE),
    buscarColumna_(col, COL_FECHA_NOMBRE),
    buscarColumna_(col, COL_IMPORTE_NOMBRE),
    buscarColumna_(col, COL_JUSTIFICANTE_NOMBRE),
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
