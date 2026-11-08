# Survival playground

El playground aparece antes de contacto en `index.html` e `index-mobile.html`.
No añade un enlace ni una parada a la navegación principal. El personaje debe
sobrevivir a los marines, sus disparos y las nuevas amenazas que aparecen con
el tiempo. El HUD muestra vida, tiempo sobrevivido, derrotas y carga de Gear Second.
Ocupa una franja propia encima del escenario para dejar libres los saltos: cuatro
paneles en PC y en modo horizontal, con dos filas en la vista previa vertical. La vida conserva brevemente el daño reciente
en su barra; Gear Second muestra la carga, el estado listo y su duración activa.

## Controles

| Acción | PC | Celular |
| --- | --- | --- |
| Correr | A / D o flechas izquierda / derecha | Mantener izquierda / derecha |
| Saltar | Espacio, W o flecha arriba | Botón Jump |
| Salto más alto | Mantener Espacio un poco más | Mantener Jump un poco más |
| Puñetazo rápido desde el suelo | Clic corto, J o X | Toque corto en Attack |
| Puñetazo de mayor fuerza y alcance | Mantener clic, J o X y soltar | Mantener Attack y soltar |
| Patada descendente desde el aire | Clic, J o X durante el salto | Attack durante el salto |
| Pausar | Escape o Pause | Pause |
| Activar Gear Second con carga completa | G | Botón G2 en la barra del juego |
| Haki del conquistador (desde 1:00) | K | Botón Haki en el margen derecho |
| Pantalla completa | Botón Fullscreen, opcional | Automática al iniciar |

Pulsa Play para comenzar. El puñetazo se lanza al soltar: un clic corto prepara
un golpe rápido y una pulsación larga acumula fuerza y alcance. La carga llega
al máximo en 1.3 segundos en forma base (más rápido en Gear Second); seguir
manteniendo no aumenta el límite. La extensión máxima del brazo es de 300
unidades. Los golpes de hasta un segundo conservan su fuerza y alcance previo;
el tiempo adicional permite llegar más lejos y aumenta el daño máximo a 59.
La barra sobre
el personaje muestra la carga, mientras su postura se prepara para el golpe.
Al mantenerla, balancea el peso sobre el pie trasero y concentra energía en la
mano; la preparación continúa animada incluso con la carga al máximo.
Los golpes rápidos tienen menor recuperación. La patada aérea conserva su carga
automática para ejecutarse con un toque durante el salto. El personaje ataca hacia el lado que está
mirando. Los controles de movimiento y acción del celular admiten pulsaciones
simultáneas. Pausa y Restart están en la esquina superior del área de juego.
Para cambiar de dirección basta deslizar el mismo dedo entre Left y Right,
incluido el espacio entre los botones. Al salir del área de movimiento se
libera la dirección; el mismo contacto puede volver a entrar. Otros dedos
pueden mantener Jump o Attack sin interferir con ese deslizamiento. Levantar,
cancelar el toque, pausar o girar el teléfono limpia las direcciones mantenidas.
La patada alarga la pierna en su eje de descenso y conserva el tamaño de la
sandalia. Su alcance se adapta a la distancia al suelo y vuelve a la postura
normal al aterrizar, sin atravesar el piso.

El salto tiene altura variable: mantener el botón sostiene el ascenso y soltarlo
lo corta de inmediato. La forma base alcanza unas 167 unidades de altura y
Gear Second unas 210, con caída rápida y control lateral en el aire. Un toque
corto permite saltos bajos; volver a pulsar en el aire no restaura el impulso.
Se conservan el margen para saltar al borde y la pulsación anticipada al aterrizar.

## Pantalla completa y proporciones

En PC, Fullscreen permite entrar antes o durante la partida. Exit o la salida
del navegador devuelven el juego a su lugar en la página y pausan la partida.
El resto del portafolio queda fuera del foco y sin interacción mientras el juego
ocupa la pantalla; al salir se restauran el scroll y los elementos de la página.

En dispositivos táctiles sin cursor, Start run solicita pantalla completa y
bloqueo horizontal desde el mismo gesto del usuario. Si el navegador no permite
pantalla completa nativa se utiliza toda la ventana disponible; si no permite
bloquear la orientación se pide girar el teléfono. En vertical el juego no
avanza y los controles quedan bloqueados. Al volver a horizontal, Continue
reanuda mediante un gesto explícito. Nunca se fuerza la reanudación al girar.
La solicitud de bloqueo horizontal no se espera para habilitar Continue: el
botón comprueba la orientación real y no vuelve a solicitar pantalla completa.
Si el navegador deja alguna solicitud pendiente, Continue puede iniciar el
juego igualmente; una respuesta antigua no reinicia ni interrumpe la partida.

La física y la cámara usan siempre un mundo de 960 × 440, con suelo en 368,
tanto en PC como en móvil. El escenario se ajusta conservando esa proporción,
sin recortarlo ni cambiar su ancho lógico al redimensionar. Personajes, alcance,
velocidades, hitboxes, cantidad de enemigos y posiciones de proyectiles son los
mismos en ambos dispositivos. Las barras van arriba y los botones táctiles a
los lados de la franja inferior, con espacio propio para los logros. Se respetan
las áreas seguras del teléfono y los controles admiten varios dedos a la vez.

## Audio

Los efectos y las cuatro pistas se leen de `assets/sprites/sound-effects/`.
Al visitar la página, después de cargar sus recursos iniciales, se descargan
efectos y soundtracks en segundo plano: dos archivos simultáneos con prioridad
baja y revalidación de la caché en cada visita, para detectar archivos reemplazados
sin repetir descargas dentro de la misma visita. Esta precarga no crea un reproductor ni un
AudioContext y nunca reproduce sonidos. Solo Start run/Restart desbloquean el
audio. Los soundtracks se conservan comprimidos y se reproducen mediante URLs
locales de los bytes descargados; únicamente los efectos se decodifican para
Web Audio al iniciar. Las descargas no bloquean la página ni el comienzo del
juego, y una descarga que termina después de pausar o reiniciar no puede
activar música por su cuenta.
La música empieza con Play, alterna pistas al azar sin repetir la anterior y
se pausa al detener la partida. El botón Sound silencia música y efectos.
Los offsets de `AUDIO_CUES` en `character-audio.js` eliminan silencios iniciales
y seleccionan un solo corte de espada del archivo que contiene varios sonidos.
Los archivos originales permanecen intactos. La patada reproduce la caída en un
bucle corto y salta al impacto final al alcanzar un enemigo o el suelo; no se
reproduce ese impacto por anticipado. Los efectos se congelan al pausar y se
limpian al reiniciar. Si un audio falla, la partida sigue funcionando.

Al conseguir un logro se reproduce únicamente `achievement.mp3`, de inmediato.
Se utiliza el archivo completo desde el inicio, sin el recorte de versiones anteriores.
El efecto tiene prioridad sobre las ráfagas y respeta pausa, reinicio y silencio.

Los disparos reales activan `gunshot`; el ataque ascendente activa
`spinning-sword-attack`. El puño mantenido utiliza `punch-charged` separado en
voz de preparación, lanzamiento e impacto. La voz se dice una vez mientras se
carga y el impacto final solo se reproduce si se alcanza a un enemigo. Al
recuperar el brazo suena `arm-return`, ajustado al tiempo de regreso. Un clic
rápido conserva el golpe normal. `health-sound` suena al recoger un objeto de
curación; la curación de Gear Second mantiene su propio efecto.
Un puñetazo corto que termina sin golpear enemigos ni romper proyectiles
reproduce al azar uno de los primeros tres cortes de `Whoosh-Sounds.mp3`.
La comprobación espera al final de la ventana del golpe y solo suena una vez;
los puñetazos cargados y las patadas conservan sus efectos propios.

`bullet-animation.png` contiene los tres fotogramas de la bala, que conserva su
trayectoria y gira hacia donde viaja. La boca del rifle se define en el último
fotograma de apuntado y es compartida por el disparo y la guía visual.

## Gear Second

Derrotar marines llena el medidor de Gear Second. Cuando llega al 100%, G inicia
una transformación de 2.05 segundos: preparación agachada, pose de
bombeo, piel rosada selectiva, vapor y una onda de presión. Mientras se transforma
se bloquean movimiento y ataques. Si se solicita en el aire o durante un golpe,
la transición espera un aterrizaje/recuperación seguros. Mantener G no repite
la transformación ni permite activarla sin carga.
El panel de Gear 2 muestra «Press G to activate» al completar la carga; en
controles táctiles muestra «Tap G2 to activate». El aviso ocupa el espacio del
panel y desaparece al activar la transformación, sin cubrir el escenario.

Al activarse recupera toda la vida y concede 12 segundos de poder. Durante ese
tiempo, cada enemigo derrotado restaura un 10% de la vida máxima (10 puntos
con 100 de vida máxima), sin superar el 100%. Cada baja cura una sola vez,
también cuando un mismo ataque derrota a varios enemigos. Los golpes no letales
y las bajas fuera de la duración activa no curan. Al terminar
revierte automáticamente en un momento seguro; el tinte y el vapor se disipan y
los valores base se recuperan. G no desactiva manualmente la transformación.
Restart también devuelve el personaje a su estado normal. La carga debe ganarse
de nuevo en la siguiente activación. El bloqueo de controles y los relojes se
respetan al pausar; las transiciones cinematográficas congelan las amenazas.

Los modificadores están centralizados en `GEAR2_TUNING`, dentro de
`assets/js/character-gear.js`:

| Estadística | Gear Second |
| --- | --- |
| Velocidad horizontal | ×1.60 |
| Aceleración | ×1.40 |
| Impulso de salto | ×1.12 |
| Ejecución de ataques y carga | ×1.50 |
| Daño | ×1.35 |
| Tiempo de recuperación | ×0.75 |

La recuperación se aplica independientemente de la velocidad de ejecución, sin
sumar multiplicadores al transformar repetidamente. Los ataques usan sus ventanas
físicas y la misma extensión de brazo/pierna que el render. La API
`getAttackHitboxes(state, getPose(state))` devuelve cápsulas con daño y barrido
entre pasos. `resolveAttackHits(state, targets, hitboxes)` aplica daño a objetivos
rectangulares `{id, x, y, width, height, health}` una sola vez por golpe. El motor
de supervivencia consulta estas cápsulas dentro del paso fijo de física.

El tinte se calcula en Canvas sobre copias en memoria a resolución original.
Solo cambia la máscara de piel; se protegen el dorado y las sombras del sombrero,
la ropa, el cabello, los ojos y cada valor de alfa. La pose de referencia reutiliza
las piernas flexionadas, la cabeza inclinada y el brazo de los PNG existentes.
La máscara agrupa zonas completas de piel, incluidas sus sombras, y se comparte
con la pose de transformación y las extremidades elásticas. No se reemplaza ni
escribe ningún sprite original. El vapor usa pequeñas nubes escalonadas con
luces y sombras, sin filtros; sus posiciones se independizan del personaje al
emitirse. Al correr, se desvanece a un máximo de 64 unidades del cuerpo, con una
vida de 0.16–0.22 segundos para evitar una estela larga.
Una parte de las bocanadas se dibuja delante del torso y los hombros, con menor
opacidad para mantener legibles las animaciones del personaje.
Las partículas y las estelas tienen límites fijos y se detienen al pausar. La
preferencia de movimiento reducido elimina la sacudida y las imágenes residuales.

El estado normal de espera utiliza `waiting`; después de permanecer sin actuar
se reproduce `inactivity`. Cualquier movimiento nuevo permite continuar jugando.
La página conserva su scroll habitual fuera del juego.
También se pausa al salir del área jugable, cambiar de ventana u ocultar la
pestaña, para que no se pierda el control del personaje mientras no se está jugando.

## Haki del conquistador

Se desbloquea a los 60 segundos de partida. K o el botón Haki activan una
descarga que elimina inmediatamente a los marines vivos cuyo cuerpo esté dentro
del escenario: fusileros, espadachines y fusileros antiaéreos. Los proyectiles y
cañonazos siguen existiendo. Durante los primeros seis segundos se bloquea la
aparición de marines y se elimina a cualquiera que entre desde fuera. Después
regresan de uno en uno mientras se desvanece el efecto; esas nuevas tropas
sobreviven. Las bajas cuentan para kills y logros, cargan Gear 2 en forma
normal y aplican su curación por baja mientras Gear 2 está activo.

La recarga es de 60 segundos de juego desde la activación. Mantener K no repite
la habilidad; se necesita una pulsación nueva. El botón muestra el tiempo hasta
el desbloqueo y después el cooldown. No se puede activar durante una transición
de Gear, pero el jugador conserva movimiento, salto y ataques durante el efecto.

`haki.gif` se decodifica una vez en sus fotogramas originales, con transparencia,
disposición y tiempos del archivo. Esto permite repetirlo desde el inicio y
congelarlo al pausar sin depender de la reproducción automática del navegador.
La onda expansiva usa anillos de cuatro píxeles cuyo epicentro sigue al personaje
incluso al correr o saltar. El filtro rojizo se dibuja por delante de los NPC y
del resto del escenario; la animación del GIF también acompaña al personaje.

El audio completo `Conqueror-Haki.mp3` dura actualmente 14.6808125 segundos.
La limpieza y el bloqueo de marines duran 6 segundos. El filtro, la onda y el GIF
se desvanecen suavemente del segundo 4 al 8; la música del efecto continúa hasta
su final, con el combate ya reanudado. El reloj del audio gobierna las fases incluso durante las
transiciones cinematográficas; silenciar no alarga su duración. Pausar congela
imagen y audio, y morir o reiniciar cancela ambos. Si no hay audio disponible,
la animación usa el reloj del juego y sigue terminando de forma normal. La
preferencia de movimiento reducido conserva el tinte y un fotograma estático.

## Supervivencia y descubrimientos

La partida termina al agotarse la vida. Los objetos de carne que aparecen
en el escenario recuperan parte de ella; Gear Second la restablece por completo.
El resumen conserva el tiempo y las derrotas de esa partida. Restart comienza
otra partida y reinicia la dificultad, la carga y el reloj.

La primera amenaza llega a los 3 segundos. Durante todo el primer minuto la
dificultad permanece estable: como máximo dos fusileros, balas a 140 unidades por
segundo y una preparación larga entre disparos. Entran desde fuera del escenario,
buscan distancia, muestran su línea de apuntado y fijan el objetivo antes de
disparar; las filas traseras mantienen el fuego sin dañar a sus compañeros.

La dificultad empieza a crecer a partir de 1:00. Desde los 75 segundos pueden
aparecer espadachines. Primero cortan a ras del suelo; desde los 115 segundos
responden a los saltos con su ataque ascendente y su animación de torbellino.
Los cañonazos empiezan a los 95 segundos, desde distintos bordes, con un aviso y
una trayectoria recta hacia la posición prevista del jugador.
`survivalPressure()` incrementa progresivamente frecuencia, velocidad y tamaño
de las oleadas. Alrededor de 1:30 pueden coincidir cuatro NPC, hacia 2:00, seis,
y hacia 3:00, diez. La curva emplea una escala de 55 segundos y las ráfagas de
cañón añaden un proyectil cada 85 segundos desde su aparición, para separar la
introducción de amenazas y mantener una subida gradual.
El límite de enemigos simultáneos es 26 y el de proyectiles 160 en ambas
versiones. El motor también admite mundos compactos para consumidores externos,
pero el playground publicado comparte siempre el mundo completo. La velocidad
de balas, cañonazos y enemigos sigue aumentando con el tiempo; la preparación
y recuperación de los ataques y el intervalo entre oleadas siguen reduciéndose.
La progresión no se detiene al alcanzar los límites de entidades. Las ráfagas
de cañón llegan a cinco proyectiles y los NPC que ya están en pantalla también
ajustan su velocidad a la dificultad actual.

Las explosiones alcanzan 152 unidades de radio y siguen activas durante su
animación. Su radio de daño crece con los fotogramas: entrar en una explosión
todavía activa también hace daño, una sola vez por explosión. Los tornados crecen
hasta 300 unidades de altura y 64 de radio; su dibujo y colisión usan la misma
geometría de `character-world-effects.js`. Se esquivan por los lados.
Los cuatro fotogramas de explosión usan celdas completas de 543 × 724 del PNG,
con anclas centradas en el efecto visible. La escala uniforme de cada fase
conserva partículas y humo completos y coincide con el tamaño de daño previsto.

Las colisiones usan el cuerpo, excluyendo los sombreros y las extremidades
estiradas del área vulnerable del jugador. Los proyectiles comprueban todo el
recorrido de cada paso, y cada golpe daña una sola vez a cada objetivo. Tras
recibir daño hay 0.65 segundos de protección. Un puñetazo o patada activos pueden
romper balas y cañonazos; estos últimos explotan sin dañar al jugador al romperlos.

`SURVIVAL_TUNING`, en `character-survival.js`, concentra vida máxima (100),
carga por baja (15), duración de Gear 2 (12 segundos), curación por baja en Gear 2
(10% de la vida máxima), protección tras daño
(0.65 segundos) y curación de objetos (28). Los objetos aparecen cada 14–22
segundos después del primero, a los 10 segundos; como máximo quedan dos en el
suelo y no se consumen si ya se tiene toda la vida. La barra de Gear 2 se llena
tras siete bajas en forma normal y muestra el tiempo restante durante su uso.

Cada 15 bajas en una partida se descubre un dato real del portafolio,
elegido al azar entre los que todavía no se han descubierto. La notificación
utiliza `assets/sprites/achievement.png` y ocupa una franja propia, sin tapar el
escenario, el HUD o los controles táctiles. El reloj de juego controla sus seis
segundos de duración, por lo que una pausa no los consume.
Sobrevivir sin conseguir bajas no entrega logros. Las partidas nuevas reinician
el contador de bajas para los siguientes premios, conservando el registro previo.
En móvil, G2 está junto a Jump y Attack; en PC se activa con G. La barra superior
contiene pantalla completa, sonido, pausa y reinicio, sin narración de las acciones.

El registro **Discoveries** conserva los datos descubiertos entre partidas y
recargas mediante `localStorage`. Abrirlo pausa el juego y permite seguir los
enlaces a la biografía, proyectos, documentos y mundos creativos que respaldan
cada dato. Si el navegador bloquea el almacenamiento, el registro sigue
funcionando en memoria durante esa visita. Al completar la colección pueden
reaparecer notificaciones, pero no se duplican sus entradas.

Los hechos se definen en `ACHIEVEMENT_FACTS`, dentro de
`assets/js/character-achievements.js`. Cada entrada contiene texto, fuente local,
enlace y fragmentos de evidencia. Las pruebas verifican esa evidencia contra los
archivos publicados; al cambiar una biografía o un proyecto conviene revisar
también los datos relacionados. El módulo no hace solicitudes de red durante
la partida ni confía en texto o enlaces guardados por el navegador: solo restaura
identificadores reconocidos y tiempos válidos.

## Dónde editar

| Archivo | Responsabilidad |
| --- | --- |
| `assets/js/character-playground.js` | Canvas, carga del personaje y controles |
| `assets/js/character-display.js` | Mundo fijo, pantalla completa y orientación horizontal |
| `assets/js/character-touch.js` | Zona continua para deslizar entre las direcciones táctiles |
| `assets/js/character-haki.js` | Duración del haki, ambiente rojizo y onda pixelart |
| `assets/js/character-gif.js` | Decodificación local del GIF con pausa y reproducción por tiempo |
| `assets/js/character-physics.js` | Movimiento, saltos y estados de combate |
| `assets/js/character-sprites.js` | Fotogramas y anclas de las animaciones |
| `assets/js/character-punch.js` | Extensión y recuperación del brazo sin deformar cuerpo ni puño |
| `assets/js/character-combat-motion.js` | Preparación animada del puño y extensión de la patada aérea |
| `assets/js/character-gear.js` | Estados de transformación y modificadores configurables |
| `assets/js/character-gear-art.js` | Máscara de piel y pose compuesta con los sprites originales |
| `assets/js/character-gear-effects.js` | Vapor, estelas y ondas de presión pixelart |
| `assets/js/character-combat.js` | Hitboxes, barrido de colisiones y aplicación de daño |
| `assets/js/character-survival.js` | Marines, disparos, dificultad, vida y recompensas |
| `assets/js/character-world-renderer.js` | Escenario, enemigos y efectos del mundo |
| `assets/js/character-world-sprites.js` | Recortes y anclas de los recursos del escenario |
| `assets/js/character-achievements.js` | Datos comprobables, notificaciones y colección persistente |
| `assets/css/character-playground.css` | Presentación y controles adaptables |
| `scripts/character-playground-template.mjs` | Marcado compartido de ambas versiones |
| `assets/sprites/` | PNG originales del personaje |

Los sprites originales se conservan. Los recortes, escalas y anclas de renderizado
se definen en los metadatos para que los cambios entre animaciones mantengan las
proporciones y la posición del personaje. Respeta las mayúsculas de `Jumping.png`
al publicar en GitHub Pages.

Sirve el repositorio con un servidor estático para revisar el juego: el controlador
usa módulos de JavaScript y no debe abrirse mediante `file://`. Ejecuta `npm test`
para comprobar física, integración y la integridad de los recursos.
