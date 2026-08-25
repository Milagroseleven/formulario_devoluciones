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

## Campos del formulario

| # | Campo | Obligatorio | Notas |
| --- | --- | --- | --- |
| 1 | Nombre y apellidos | Sí | Titular de la cuenta |
| 2 | Teléfono de contacto | Sí | |
| 3 | Correo electrónico | Sí | Se valida el formato |
| 4 | Fecha de la reserva | Sí | No admite fechas futuras |
| 5 | Modalidad de reserva | Sí | TPV datáfono · Cash · Reserva por la web · Transferencia a cuenta · Bizum a número de móvil |
| 6 | Modelo de la moto | Sí | |
| 7 | Matrícula o código | Sí | Se guarda en mayúsculas |
| 8 | Nombre del comercial | Sí | Quien atendió al cliente |
| 9 | Motivo de la devolución | Sí | Cancelación de financiación · Desistimiento · Motivos personales · Otros |
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

## Seguimiento interno (las 4 últimas columnas)

Estas columnas no las toca el cliente: las lleva el encargado a mano sobre
la propia hoja. No hace falta ningún aviso automático; el encargado revisa
las filas en `Pendiente` y las va cerrando.

| Columna | Cómo funciona |
| --- | --- |
| `Estado devolución` | Desplegable `Pendiente` / `Devolución efectuada`. Toda solicitud nueva entra como `Pendiente` |
| `Fecha transferencia` | Fecha a mano, formato `dd/mm/aaaa` |
| `Importe` | Importe devuelto, formato euros |
| `Justificante enviado al comercial` | Desplegable `Ok` / `Pendiente` |

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

1. Abrir el Google Sheet que recibe las solicitudes (el que ya está
   configurado en `HOJA_ID`).
2. En ese Sheet: **Extensiones → Apps Script**.
3. Pegar `Code.gs` e `Index.html` (este último con **+ → HTML**, nombre
   `Index`).
4. En **Configuración del proyecto**, marcar "Mostrar el archivo de
   manifiesto `appsscript.json`" y pegar el contenido de `appsscript.json`.
5. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario, incluso anónimo**
6. Autorizar los permisos y copiar el enlace `/exec`: ese es el que se envía
   a los clientes.
7. Volver al Sheet, recargarlo y ejecutar **Devoluciones → Preparar columnas
   de seguimiento** una vez.

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
| `MOTIVOS` | Opciones del campo 9 |
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

- Texto legal exacto de la casilla de consentimiento (ahora hay una
  redacción provisional) y si hay que enlazar una política de privacidad.
