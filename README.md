# Formulario de devoluciones de reservas

Formulario web (Google Apps Script) para que **el propio cliente** solicite
la devolución del importe que entregó como reserva de una moto. Se le envía
el enlace, lo rellena desde el móvil y cada envío deja una fila en un Google
Sheet, con el certificado de titularidad guardado en Drive.

Es el hermano simplificado del formulario de movimientos de caja
(`Formulario_cash`): mismo esqueleto, pero sin sedes, sin conceptos
derivados y con los textos redactados para una persona externa a la empresa.

## Archivos

| Archivo | Qué es |
| --- | --- |
| `Code.gs` | Lógica del servidor: validación, subida a Drive, fila en el Sheet |
| `Index.html` | El formulario que ve el cliente |
| `appsscript.json` | Configuración del proyecto y del despliegue web |
| `INSTALACION.md` | Guía de instalación paso a paso, para hacerla sin experiencia |

## Campos del formulario

| # | Campo | Obligatorio | Notas |
| --- | --- | --- | --- |
| 1 | Nombre y apellidos | Sí | Titular de la cuenta |
| 2 | Teléfono de contacto | Sí | |
| 3 | Correo electrónico | Sí | Se valida el formato |
| 4 | Fecha de la reserva | Sí | No admite fechas futuras |
| 5 | Modalidad de reserva | Sí | TPV datáfono · Cash · Reserva por la web · Transferencia a cuenta · Bizum a número de móvil |
| 6 | Modelo de la moto | Sí | |
| 7 | Matrícula | Sí | Valida el formato: 3720 KDV, A 108859, M 8214 YV, C 2107 BWM, con el número de unidad opcional al final |
| 8 | Nombre del comercial | Sí | Quien atendió al cliente |
| 9 | Motivo de la devolución | Sí | Financiación no aprobada · Desistimiento · Motivos personales · Otros. Decide quién valida la devolución |
| 10 | Explica el motivo | Solo si el motivo es "Otros" | Aparece únicamente al elegir "Otros" |
| 11 | Número de cuenta (IBAN) | Sí | Se valida con el dígito de control (ISO 13616) |
| 12 | Certificado de titularidad | Sí | PDF o imagen, hasta 10 MB |
| 13 | Autorización de tratamiento de datos | Sí | Casilla de consentimiento |

El cliente **no indica el importe**: lo cruza administración con sus propios
registros, para que nadie pueda declarar una cifra que no corresponde. El
campo 13 no estaba en la lista inicial; se añadió porque el formulario es
público y recoge datos bancarios.

## Cómo se guarda cada solicitud

- **Sheet**, pestaña `Solicitudes`: una fila por solicitud, con la fecha de
  registro, el ID, los datos del cliente, el enlace al certificado y las
  cuatro columnas de seguimiento interno.
- **Drive**, carpeta `Devoluciones de reservas`: el certificado, con el
  nombre `<matrícula> - Certificado titularidad - <cliente> - <ID>.<ext>`.
- **ID de solicitud**: `DEV-<aaaammdd>-<4 caracteres>`. Se le muestra al
  cliente al terminar, con un botón para copiarlo.

## Columnas propias en la hoja

El script **busca cada columna por su título en la fila 1**, no por su
posición. Eso permite insertar, mover o quitar columnas en la hoja sin tocar
el código: columnas de fórmulas, indicadores, lo que haga falta.

Dos reglas para que siga funcionando:

- **No renombrar** las columnas que escribe el formulario. Si falta alguna,
  el envío falla con un aviso diciendo cuál, antes de subir nada a Drive.
- Las columnas con **fórmulas se arrastran solas**: al entrar una solicitud,
  el script copia a la fila nueva las fórmulas de la fila anterior, con su
  formato. Se detectan solas, no hay que declararlas en ningún sitio.

El **formato condicional** no lo gestiona el script: es una regla de Sheets
que se aplica a un rango. Conviene definirla sobre un rango amplio (por
ejemplo `O2:Q2000`) para que cubra las filas que aún no existen.

> La primera solicitud de una hoja vacía no tiene fila anterior de la que
> copiar, así que ahí las fórmulas hay que ponerlas a mano una vez.

## Aprobaciones: quién autoriza cada devolución

Hay dos columnas de aprobación en la hoja, y **cada una solo la puede
escribir su gente**. El bloqueo lo aplica el script, no se pone a mano:

| Columna | Quién puede escribir |
| --- | --- |
| `Aprobación Financiaciones` | financiaciones@ · las dos cuentas de servicio · la administradora |
| `Aprobación Gon / Jaime / Nacho` | gonzalo@ · gonzalo.garnelo@gmail · jaime@ · nacho.carrion@ · las dos cuentas de servicio · la administradora |

Las listas están en `COLUMNAS_PROTEGIDAS`, al principio de `Code.gs`. Al
cambiarlas hay que ejecutar **Devoluciones → Preparar columnas de
seguimiento** para que se apliquen.

Los títulos se comparan sin distinguir mayúsculas ni espacios de más, así
que un encabezado escrito en dos líneas dentro de la celda también encaja.
Si aun así no se encuentra alguno, el menú abre una ventana con los títulos
que hay de verdad en la fila 1 para poder compararlos.

> Hacerlo desde el menú de Sheets (*Datos → Proteger hojas e intervalos*)
> funciona, pero por defecto deja el intervalo en **"Solo tú"**: hay que
> entrar en *Establecer permisos → Restringir quién puede editar este
> intervalo → Personalizado* y marcar a cada persona. Y las cuentas de
> servicio no aparecen en ese buscador, así que por script es el único
> camino cómodo para incluirlas.

### Cuál hace falta en cada fila

Depende del motivo de la devolución, y se ve de un vistazo porque **la
validación que no toca sale sombreada en gris**:

| Motivo | Valida | Se sombrea |
| --- | --- | --- |
| `Financiación no aprobada` | Financiaciones | La de Gon / Jaime / Nacho |
| Cualquier otro | Gon / Jaime / Nacho | La de Financiaciones |

Los colores son formato condicional que crea el propio script calculando
dónde está cada columna, así que aparecen y desaparecen solos en cuanto
cambia el motivo:

| Color | Qué significa |
| --- | --- |
| Gris | Esa validación no aplica en esa fila. No hay que rellenarla |
| Amarillo | Es la que toca y sigue vacía: está pendiente |
| Sin color | Ya está validada |

La leyenda queda también como nota sobre el título de las dos columnas, para
poder consultarla sin preguntar. Si una fila no tiene motivo todavía, no se
colorea ninguna.

**Las listas desplegables se estiran solas.** Al ejecutar *Preparar columnas
de seguimiento*, el script coge la lista que ya está puesta en cada columna
y la aplica hasta la fila 2000, para que las solicitudes nuevas lleguen con
su desplegable.

Vale para las cuatro columnas con lista: las dos de aprobación, `Estado
devolución` y la del justificante. **Siempre reutiliza la lista que hay en
la hoja**, nunca la crea de nuevo, y por eso se conservan los colores y el
orden que le hayas dado a cada opción. Las opciones se cambian en la hoja y
basta con volver a ejecutar el menú.

Las solicitudes registradas antes del cambio de nombre llevan el motivo
antiguo, `Cancelación de financiación`. El sombreado también lo reconoce,
así que esas filas se siguen viendo bien sin tener que tocarlas.

## Seguimiento interno (las 4 últimas columnas)

Estas columnas no las toca el cliente: las lleva el encargado a mano sobre
la propia hoja. No hace falta ningún aviso automático; el encargado revisa
las filas en `Pendiente` y las va cerrando.

| Columna | Cómo funciona |
| --- | --- |
| `Estado devolución` | Desplegable `Pendiente` / `Devolución efectuada`. Toda solicitud nueva entra como `Pendiente` |
| `Fecha transferencia` | Fecha a mano, formato `dd/mm/aaaa` |
| `Importe` | Importe devuelto, formato euros |
| `Justificante enviado al comercial y/o al grupo de devolución de reservas` | Desplegable `Ok` / `Pendiente` |

Al pasar una fila a **`Devolución efectuada`**, las otras tres columnas se
vuelven obligatorias: las que estén vacías se pintan de rojo, les aparece
una nota al pasar el ratón y salta un aviso en la esquina de la pantalla.
El rojo desaparece solo en cuanto se rellenan. Google Sheets no permite
bloquear una celda de verdad, así que el aviso es visible pero no impide
seguir trabajando.

En el menú **Devoluciones** de la hoja hay dos opciones:

- *Preparar columnas de seguimiento*: vuelve a aplicar desplegables y
  formatos (hay que ejecutarla una vez tras instalar el script).
- *Revisar devoluciones incompletas*: repasa toda la hoja y marca en rojo
  lo que falte, útil para las filas anteriores a la instalación.

## Instalación

**Los pasos detallados, pantalla por pantalla, están en
[INSTALACION.md](INSTALACION.md).** Esa guía está escrita para hacerla sin
conocimientos previos; lo de aquí abajo es solo el resumen para quien ya
conozca Apps Script.

1. En el Sheet que recibe las solicitudes: **Extensiones → Apps Script**.
2. Pegar `Code.gs` e `Index.html` (este último con **+ → HTML**, nombre
   `Index`).
3. En **Configuración del proyecto**, marcar "Mostrar el archivo de
   manifiesto `appsscript.json`" y pegar su contenido.
4. **Implementar → Nueva implementación → Aplicación web**, ejecutando como
   *Yo* y con acceso para **cualquier usuario, incluso sin cuenta de
   Google**.
5. Autorizar los permisos y copiar el enlace `/exec`: ese es el que se envía
   a los clientes.
6. Recargar el Sheet y ejecutar **Devoluciones → Preparar columnas de
   seguimiento** una vez.

> Para que un cambio llegue al enlace ya compartido hay que hacer
> **Implementar → Administrar implementaciones → editar → Nueva versión**.
> Una implementación nueva genera un enlace distinto.

## Configuración

Todo lo configurable está al principio de `Code.gs`:

| Constante | Para qué |
| --- | --- |
| `CARPETA_ID` | Carpeta de Drive donde van los certificados. Vacío = se crea `Devoluciones de reservas` en la unidad de quien despliega |
| `HOJA_ID` | Sheet que recibe las solicitudes. Vacío = la hoja en la que vive el script |
| `EMPRESA` / `NIF` | Aparecen bajo el título del formulario |
| `MODALIDADES` | Opciones del campo 5 |
| `MOTIVOS` | Opciones del campo 9. `MOTIVO_FINANCIACION` es el que decide quién valida |
| `COLUMNAS_PROTEGIDAS` | Qué cuentas pueden escribir en cada columna de validación |
| `TAMANO_MAXIMO_MB` | Peso máximo del certificado |

Añadir una modalidad o un motivo es tocar una sola lista: el formulario las
recibe por plantilla y se dibuja solo.

El script tiene que vivir **dentro del propio Sheet** (Extensiones → Apps
Script): el disparador `onEdit` que vigila las columnas de seguimiento solo
funciona en la hoja que contiene el script.

## Decidido

- El cliente **no** recibe correo de confirmación: solo ve su código en
  pantalla.
- **No** se envía aviso a administración con cada solicitud: el encargado
  revisa la hoja y actualiza el estado.
- **Descartado** avisar por WhatsApp, como se hace con los pedidos de los
  comerciales: estas solicitudes llevan IBAN y certificado de titularidad, y
  un grupo de WhatsApp no es sitio para eso.

## Pendiente de confirmar

- **Quién puede marcar una devolución como efectuada.** Las dos columnas de
  validación ya están restringidas, pero la columna `Estado devolución`
  sigue abierta a cualquiera con edición en la hoja.

- Texto legal exacto de la casilla de consentimiento (ahora hay una
  redacción provisional) y si hay que enlazar una política de privacidad.
