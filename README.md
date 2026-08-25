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
| 11 | Importe de la reserva (€) | Sí | Normalmente entre 200 y 250 €, pero admite cualquier importe |
| 12 | Número de cuenta (IBAN) | Sí | Se valida con el dígito de control (ISO 13616) |
| 13 | Certificado de titularidad | Sí | PDF o imagen, hasta 10 MB |
| 14 | Autorización de tratamiento de datos | Sí | Casilla de consentimiento |

Los campos 11 y 14 no estaban en la lista inicial: se añadieron porque sin
importe no se puede cuadrar la devolución, y porque el formulario es público
y recoge datos bancarios. Quitarlos es fácil si no hacen falta.

## Cómo se guarda cada solicitud

- **Sheet**, pestaña `Solicitudes`: una fila por solicitud, con la fecha de
  registro, el ID, todos los campos, el enlace al certificado y una columna
  `Estado` que nace como `Pendiente de revisar` para que administración la
  vaya actualizando a mano.
- **Drive**, carpeta `Devoluciones de reservas`: el certificado, con el
  nombre `<matrícula> - Certificado titularidad - <cliente> - <ID>.<ext>`.
- **ID de solicitud**: `DEV-<aaaammdd>-<4 caracteres>`. Se le muestra al
  cliente al terminar, con un botón para copiarlo.

## Instalación

1. Crear un Google Sheet nuevo (es el que recibirá las solicitudes).
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

> Para que un cambio llegue al enlace ya compartido hay que hacer
> **Implementar → Administrar implementaciones → editar → Nueva versión**.
> Una implementación nueva genera un enlace distinto.

## Configuración

Todo lo configurable está al principio de `Code.gs`:

| Constante | Para qué |
| --- | --- |
| `CARPETA_ID` | Carpeta de Drive donde van los certificados. Vacío = se crea `Devoluciones de reservas` en la unidad de quien despliega |
| `NOTIFICAR_A` | Correo que recibe un aviso con cada solicitud. Vacío = no se envía nada |
| `EMPRESA` / `NIF` | Aparecen bajo el título del formulario |
| `MODALIDADES` | Opciones del campo 5 |
| `MOTIVOS` | Opciones del campo 9 |
| `TAMANO_MAXIMO_MB` | Peso máximo del certificado |

Añadir una modalidad o un motivo es tocar una sola lista: el formulario las
recibe por plantilla y se dibuja solo.

## Pendiente de confirmar

- Texto legal exacto de la casilla de consentimiento (ahora hay una
  redacción provisional) y si hay que enlazar una política de privacidad.
- Si el cliente debe recibir un correo de confirmación con su código.
- Si la empresa y el NIF son los correctos para este formulario.
