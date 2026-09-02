# Guía de instalación paso a paso

Esta guía está escrita para hacerla sin conocimientos previos de
programación. No hay que instalar nada en el ordenador: todo se hace desde
el navegador, dentro de Google.

**Tiempo aproximado:** 20 minutos la primera vez.

**Qué vas a conseguir:** un enlace que se le manda al cliente. Cuando lo
rellena, aparece una fila nueva en tu Google Sheet y el certificado de
titularidad se guarda en Drive.

---

## Antes de empezar

**Inicia sesión con la cuenta de Google de la empresa**, no con una
personal. Es importante por dos motivos:

- Los certificados de titularidad se guardarán en el Drive **de esa cuenta**.
- Si esa persona se va de la empresa y se cierra su cuenta, el formulario
  deja de funcionar.

Ten a mano los tres archivos del proyecto, que están en la carpeta
`Formulario_devoluciones\formulario_devoluciones`:

- `Code.gs`
- `Index.html`
- `appsscript.json`

### Cómo abrirlos para copiar el código

Aquí hay una trampa: si haces **doble clic** en `Index.html`, Windows lo
abre con el navegador y te enseña el formulario, no el código. Para ver el
código hay que abrirlo con el Bloc de notas:

1. **Clic derecho** sobre el archivo.
2. **Abrir con → Bloc de notas.**
3. Si el Bloc de notas no aparece en la lista, entra en **Elegir otra
   aplicación** y búscalo ahí.

Ya dentro del Bloc de notas: `Ctrl + A` selecciona todo y `Ctrl + C` copia.
Si prefieres no usar atajos, el menú **Edición → Seleccionar todo** hace lo
mismo y no falla.

Se ve feo, con símbolos raros y sin colores. Es normal: es código, y no
está pensado para leerse, solo para copiarse entero.

---

## Paso 1 · Abrir el editor de código

1. Abre el Google Sheet donde quieres recibir las solicitudes (el que ya
   está configurado en el proyecto).
2. En el menú de arriba, entra en **Extensiones → Apps Script**.
3. Se abre una pestaña nueva con un editor de código. Es el sitio donde vive
   el programa.

En la parte izquierda verás una columna con la palabra **Archivos** y, justo
debajo, un archivo llamado `Código.gs` (o `Code.gs`, según el idioma).

> Si el editor te pide crear un proyecto o le tienes que poner nombre,
> escribe algo como "Devoluciones de reservas". El nombre no afecta a nada
> del funcionamiento.

---

## Paso 2 · Pegar el código principal

1. Haz clic en el archivo `Código.gs` de la columna izquierda.
2. En la zona central verás un texto que pone
   `function myFunction() { }` o similar. **Bórralo todo**: clic dentro,
   `Ctrl + A` para seleccionar todo y `Supr`.
3. Abre `Code.gs` con el Bloc de notas, selecciona todo (`Ctrl + A`) y
   cópialo (`Ctrl + C`).
4. Vuelve al editor de Google y pega (`Ctrl + V`).
5. Guarda con `Ctrl + S`, o con el icono del disquete.

No te preocupes si aparecen subrayados de colores: son avisos del editor,
no errores.

**Comprueba que se pegó entero.** Es el fallo más habitual y no da ningún
error: simplemente el formulario sale roto. En el editor de Google, cada
línea lleva su número a la izquierda:

- Sube del todo con `Ctrl + Inicio`. La **línea 1** tiene que empezar por
  `/**`.
- Baja del todo con `Ctrl + Fin`. La última línea tiene que ser `}` y el
  número de línea rondar el **449**.

Si el número final es mucho menor, el pegado se quedó a medias: borra todo
y repite.

---

## Paso 3 · Crear el archivo del formulario

Este es el archivo que ve el cliente. Hay que crearlo aparte.

1. En la columna izquierda, al lado de **Archivos**, hay un botón **+**.
   Haz clic.
2. Elige la opción **HTML** (no "Secuencia de comandos").
3. Te pide un nombre. Escribe exactamente:

   ```
   Index
   ```

   Sin `.html` al final y con la **I mayúscula**. Google le añade la
   extensión solo. Si le pones otro nombre, el formulario no aparecerá.
4. El archivo nuevo se abre con unas líneas de ejemplo dentro. **Bórralas
   todas** (`Ctrl + A`, `Supr`).
5. Abre `Index.html` con el Bloc de notas, copia todo y pégalo ahí.
6. Guarda con `Ctrl + S`.

**Comprueba también aquí que se pegó entero**, igual que antes:

- Línea 1: `<!DOCTYPE html>`
- Última línea: `</html>`, con el número de línea rondando el **537**.

Si empieza por otra cosa, faltan trozos. Borra todo (`Ctrl + A`, `Supr`) y
vuelve a pegar.

---

## Paso 4 · Activar el archivo de configuración

Este archivo está oculto por defecto y hay que mostrarlo.

1. En la columna de la izquierda del todo, haz clic en el icono de la
   **rueda dentada** (⚙️), que es **Configuración del proyecto**.
2. Marca la casilla **"Mostrar el archivo de manifiesto appsscript.json en
   el editor"**.
3. Vuelve al editor (icono `<>` **Editor**, arriba del todo en esa misma
   columna). Ahora en **Archivos** aparece `appsscript.json`.
4. Haz clic en él, borra su contenido y pega el contenido de
   `appsscript.json` del proyecto.
5. Guarda con `Ctrl + S`.

---

## Paso 5 · Publicar el formulario

Aquí es donde se genera el enlace para los clientes.

1. Arriba a la derecha, botón azul **Implementar → Nueva implementación**.
2. Se abre una ventana. Arriba a la izquierda hay una **rueda dentada** con
   el texto "Seleccionar tipo". Haz clic y elige **Aplicación web**.
3. Rellena así:
   - **Descripción:** `Formulario de devoluciones` (es solo una nota para ti)
   - **Ejecutar como:** *Yo* (aparecerá tu correo)
   - **Quién tiene acceso:** **Cualquier usuario**

   > Esta última es la más importante. Tiene que ser la opción más abierta
   > de la lista, la que **no** exige tener cuenta de Google. Según la
   > versión aparece como *"Cualquier usuario"* o como *"Cualquier usuario,
   > incluso anónimo"*. Si eliges cualquier otra, los clientes verán una
   > pantalla pidiéndoles iniciar sesión.

4. Pulsa **Implementar**.

---

## Paso 6 · Dar permisos (la parte que asusta)

La primera vez, Google pide autorización porque el programa va a escribir en
tu Drive y en tu hoja. Verás varias pantallas seguidas. **Es normal, no está
pasando nada malo.**

1. Botón **Autorizar acceso**.
2. Elige tu cuenta de Google (la de la empresa).
3. Aparece una pantalla que dice **"Google no ha verificado esta
   aplicación"**. No te asustes: sale siempre con los programas hechos a
   medida, porque Google solo "verifica" aplicaciones publicadas al público
   general. El programa es el tuyo.
   - Haz clic en **Configuración avanzada** (abajo a la izquierda, en letra
     pequeña).
   - Luego en **Ir a Devoluciones de reservas (no seguro)**.
4. Sale la lista de permisos que pide. Pulsa **Permitir**.

Cuando termine, aparece una ventana con el título **URL de la aplicación
web**. Es un enlace largo que **acaba en `/exec`**.

**Copia ese enlace y guárdalo bien.** Ese es el que se les manda a los
clientes.

---

## Paso 7 · Preparar las columnas de la hoja

1. Vuelve a la pestaña del Google Sheet.
2. **Recarga la página** (tecla `F5`). Esto es obligatorio: el menú nuevo no
   aparece hasta que recargas.
3. En el menú de arriba, al lado de "Ayuda", verás un menú nuevo llamado
   **Devoluciones**.
4. Entra en **Devoluciones → Preparar columnas de seguimiento**.
5. La primera vez te pedirá permisos otra vez. Repite el Paso 6.

Al terminar sale un aviso abajo a la derecha diciendo "Columnas de
seguimiento preparadas". Ya están puestas las listas desplegables de las
cuatro últimas columnas.

---

## Paso 8 · Probarlo antes de mandárselo a nadie

1. Abre el enlace `/exec` en el navegador (mejor desde el móvil, que es
   donde lo va a usar el cliente).
2. Rellena el formulario con datos inventados. Para el IBAN puedes usar uno
   de prueba: `ES91 2100 0418 4502 0005 1332`.
3. Adjunta cualquier PDF o foto.
4. Envía.

Comprueba que:

- Aparece la pantalla verde con el código `DEV-...`.
- En el Sheet hay una fila nueva, con `Pendiente` en "Estado devolución".
- En Drive existe la carpeta **Devoluciones de reservas** con el archivo
  dentro.

Después **borra la fila de prueba** (clic derecho en el número de fila →
Eliminar fila) y el archivo de prueba de Drive.

---

## Cómo enviar el enlace a los clientes

El enlace funciona bien en cualquier navegador, pero **falla si el cliente lo
abre dentro de WhatsApp**. Al tocar el enlace en el chat, el móvil lo abre en
un navegador interno de la propia aplicación, y ese navegador bloquea cosas
que Google necesita. El cliente ve un error de Google Drive que dice *"No se
puede abrir el archivo en estos momentos"*.

No es un fallo del formulario ni de los permisos: en un navegador normal se
abre sin problema.

Para evitarlo, manda el enlace acompañado de una instrucción. Este texto se
puede copiar tal cual:

```
Hola, para tramitar la devolución de tu reserva necesitamos que rellenes
este formulario:

<AQUI EL ENLACE>

Dos cosas antes de empezar:

1. Si al tocar el enlace te sale un error de Google, toca los tres puntos
   de la esquina y elige "Abrir en Safari" (iPhone) o "Abrir en Chrome"
   (Android). Desde WhatsApp a veces no carga.

2. Ten a mano el certificado de titularidad de tu cuenta bancaria, porque
   hay que adjuntarlo. Sirve el PDF del banco o una foto.
```

Si un cliente ya se ha topado con el error, dile que mantenga pulsado el
enlace en el chat, elija **Copiar**, abra su navegador y lo pegue ahí.

> El mismo error puede salirle a alguien que tenga varias cuentas de Google
> abiertas en el móvil. La solución es la misma: abrirlo en el navegador, o
> en una ventana de incógnito.

---

## Cómo se usa el día a día

**El cliente** recibe el enlace y rellena el formulario. No hay que hacer
nada más por su parte.

**El encargado** abre el Sheet cada cierto tiempo y mira las filas que están
en `Pendiente`:

1. Comprueba el pago cruzándolo con los registros de la empresa.
2. Hace la transferencia.
3. En la columna **Estado devolución** elige `Devolución efectuada`.
4. Rellena **Fecha transferencia**, **Importe** y **Justificante enviado al
   comercial**.

Si marca "Devolución efectuada" y se deja alguna de las tres casillas
vacías, **se pintan de rojo** y sale un aviso. El rojo desaparece solo al
rellenarlas.

---

## Si más adelante hay que cambiar algo

Cuando se modifique el código, el enlace que ya tienen los clientes **no se
actualiza solo**. Hay que hacer esto:

1. Pega el código nuevo en el editor y guarda.
2. **Implementar → Administrar implementaciones**.
3. Clic en el **lápiz** (editar) de la implementación que ya existe.
4. En **Versión**, elige **Nueva versión**.
5. Pulsa **Implementar**.

> No uses "Nueva implementación" para actualizar: eso crea un enlace
> distinto y el que tienen los clientes se queda con la versión vieja.

---

## Si algo sale mal

| Qué ves | Qué pasa |
| --- | --- |
| El cliente ve "No se puede abrir el archivo en estos momentos" | Está abriendo el enlace dentro de WhatsApp. Tiene que abrirlo en Safari o Chrome |
| El formulario sale sin colores, sin títulos y sin campos | El archivo `Index` se pegó incompleto. Bórralo entero y vuelve a pegarlo comprobando que empieza por `<!DOCTYPE html>` y acaba en `</html>` |
| El cliente ve una pantalla pidiendo iniciar sesión | En el Paso 5 no se eligió la opción más abierta en "Quién tiene acceso". Edita la implementación y cámbialo |
| Sale "Se ha producido un error en la secuencia de comandos" | Casi siempre es que falta pegar algún archivo, o que el archivo HTML no se llama exactamente `Index` |
| No aparece el menú **Devoluciones** en la hoja | Falta recargar la hoja con `F5`. Si sigue sin salir, revisa que el código esté pegado y guardado |
| "No se pudo abrir la hoja configurada" | El código apunta a un Sheet al que esa cuenta no tiene acceso. Hay que revisar la constante `HOJA_ID` |
| Los desplegables no aparecen en las columnas | Falta ejecutar **Devoluciones → Preparar columnas de seguimiento** |

Si aparece un error que no está en esta tabla, copia el texto del error tal
cual: con eso se puede localizar el problema.
