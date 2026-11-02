# Chat local del portafolio

Funciona directamente en GitHub Pages. No necesita API, clave, `.env`, backend,
Vercel ni un modelo externo. No hay nada que activar: publica los archivos del
sitio como siempre. El botón está abajo a la derecha en todas las páginas.

El idioma se adapta a cada pregunta; las preguntas cortas conservan el idioma
anterior. No hay selector. El chat entiende consultas sobre proyectos, tecnologías,
roles, fechas, estados, modalidad, perfil y secciones, además de preguntas de
seguimiento como «¿y qué rol tuvo?» después de consultar un proyecto.

Reconoce más formas de preguntar: «qué aportó», «por su cuenta», «en qué lenguaje
está programado», nombres con pequeños errores y correcciones como «no, me
refería a Plant Bud». Resuelve referencias por número, «el último» y cambios de
proyecto conservando el campo de la pregunta anterior. Puede combinar preguntas
sobre distintas secciones en un mismo mensaje.

Los certificados publicados se consultan como registros: nota obtenida, nota
mínima cuando figura en la descripción, fecha, filtros por año y comparación
de puntajes. Cuando «Excel» puede referirse a varios registros, pide aclaración
y conserva lo que estabas preguntando. Los espacios pendientes no se convierten
en certificaciones ni logros obtenidos.

Puede responder varias partes de una pregunta, comparar datos compartidos entre
proyectos y recordar referencias como «el segundo». Usa frases más naturales y
ofrece hasta dos preguntas relacionadas para continuar. Las sugerencias no
repiten el campo que acaba de responder.

También incluye conversación casual, chistes, acertijos con solución, poemas
breves, retos creativos, explicaciones de conceptos web y cálculos sencillos.
Estos contenidos son plantillas y composiciones locales; nunca se presentan
como hechos personales de David. No consulta noticias, clima ni datos en vivo.

Las explicaciones incluyen API, JSON, Git, bases de datos, SQL, algoritmos,
variables, funciones, arrays, bucles y diseño adaptable. Después puedes pedir
«un ejemplo» o «más simple», y consultar en qué proyectos aparece una tecnología.
También puede continuar algunas charlas sobre música, videojuegos, cine o arte,
y guiar los primeros pasos de programación. Si le dices tu nombre o un interés,
lo recuerda durante esa conversación, separado de la información de David.

## Enseñarle nuevas respuestas

Edita `data/assistant-knowledge.json` y añade entradas a `entries`:

```json
{
  "entries": [
    {
      "id": "motivacion-beyond",
      "published": true,
      "title": "Motivación de Beyond",
      "questions": {
        "es": ["¿Por qué creó Beyond?", "¿Cuál fue la motivación de Beyond?"],
        "en": ["Why did David build Beyond?", "What inspired Beyond?"]
      },
      "answers": {
        "es": "Escribe aquí tu respuesta real en español.",
        "en": "Write your actual answer in English here."
      },
      "href": "index.html#projects",
      "project": "beyond"
    }
  ]
}
```

El ejemplo muestra el formato; no se ha añadido como información de David.
Usa un `id` distinto para cada entrada. Añade varias formas naturales de hacer
la misma pregunta. Las respuestas se reproducen como las escribas: puedes
corregirlas, ampliarlas o eliminar la entrada sin afectar a las demás.

El motor reconoce algunas paráfrasis y sinónimos, por ejemplo «qué lo inspiró»
frente a «por qué lo creó». Aun así, conviene añadir distintas preguntas para
los casos nuevos. Mantiene separadas las preguntas sobre motivación, dinero,
fechas y personas para no contestar con un dato que no corresponda.
La búsqueda de citas usa términos equivalentes en español e inglés y pondera
las coincidencias menos comunes. Mantiene un mínimo de coincidencia para no
convertir una mención parecida en un hecho personal.

Puedes escribir varias respuestas alternativas en cada idioma para que no
repita siempre la misma frase, conservando los mismos hechos:

```json
"answers": {
  "es": ["Una explicación real.", "La misma explicación con otras palabras."],
  "en": ["An actual explanation.", "The same explanation in different words."]
}
```

`project` es opcional y permite abrir su ficha. `href` es una ruta interna del
portafolio. También se admite una lista simple en `questions` y un campo `text`
para notas; si falta la respuesta en un idioma, el chat identifica la nota como
texto original en lugar de fingir una traducción.

`published: false` retira la entrada de las respuestas, pero **el archivo sigue
siendo público**. Añade solo información que quieras compartir con visitantes.
Los visitantes no pueden entrenar el chat ni guardar cambios en tu biografía.

## Actualización automática

La primera pregunta consulta los archivos publicados del propio sitio: `index.html`,
`data/projects.js`, `data/credentials.json`, `data/assistant-knowledge.json` y las páginas HTML enlazadas desde
`main`. Reutiliza esa información en memoria durante un minuto; la siguiente
consulta posterior a ese plazo vuelve a leer los archivos. Publica los cambios en Pages y el chat podrá leerlos sin reconstruir
un índice ni entrenar un modelo. Las secciones nuevas deben estar dentro de
`main`, tener clase `section` y un `id`; enlaza las galerías como `nombre.html`.

El chat solo lee texto y datos. No interpreta capturas, imágenes o PDF: añade
su información relevante como texto o respuestas manuales. Los campos vacíos
siguen siendo desconocidos. Las conversaciones no se envían a ningún servicio
y se conservan solo en memoria hasta recargar o pulsar nueva conversación.

No descarga modelos, no usa WebGPU y no añade dependencias de ejecución. Tampoco
consulta los datos antes de que envíes una pregunta. Las lecturas independientes
se realizan en paralelo y el índice de texto se prepara solo cuando hace falta
buscar una cita; se reutiliza con la misma información. Al cerrar o reiniciar el
chat, una consulta pendiente no puede agregar respuestas fuera de contexto.

Es un chatbot de reglas y coincidencias, no una IA generativa. Responde con
datos concretos, respuestas que escribamos o citas identificadas del sitio.
Reconoce variantes y algunos errores de escritura, pero no entiende todas las
formas posibles de preguntar. Si falta una respuesta, añade ejemplos a
`questions`; si no hay respaldo suficiente, responde que no sabe.

## Archivos

- `assets/js/assistant.js`: interfaz, detección de idioma y lectura de archivos estáticos.
- `assets/js/assistant-core.js`: preguntas, respuestas y conocimiento del sitio.
- `assets/css/assistant.css`: botón mínimo y panel holográfico.
- `data/assistant-knowledge.json`: información y respuestas que añadamos manualmente.

`package.json` y `linkedom` se usan solo para las pruebas de desarrollo
(`npm install` y `npm test`); el chat publicado no tiene dependencias de npm.
