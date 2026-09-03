# 8_CRUD — Learn It, Love It

Plataforma de temas de aprendizaje con enlaces y votaciones. Los temas y los
enlaces se reordenan solos segun los votos que reciben.

**Node.js + Express + EJS + arquitectura MVC + JavaScript puro en el cliente.**
Sin React, sin jQuery, sin librerias de frontend.

## Arrancar

```bash
npm install
npm run build      # compila Tailwind a src/public/css/app.css
npm run seed       # datos de ejemplo (no pisa nada si ya hay temas)
npm start          # http://127.0.0.1:3302
```

Desarrollo: `npm run dev` (recarga el servidor) · `npm run css:watch` · `npm test`.

| Variable | Default | Para que |
|---|---|---|
| `PORT` | `3302` | puerto |
| `HOST` | `127.0.0.1` | interfaz; loopback a proposito |
| `DATA_FILE` | `data/db.json` | ubicacion de la base |
| `SESSION_SECRET` | valor de desarrollo | **cambiar en produccion** |
| `NODE_ENV` | `development` | `production` oculta stacks y exige cookies seguras |

## Arquitectura MVC

```
src/
├── server.js             arranque y apagado ordenado
├── app.js                armado de Express y orden de middlewares
├── config/               toda la configuracion en un solo lugar
├── models/               MODELO — datos y reglas de negocio
│   ├── store.js            persistencia JSON: escritura atomica + cola
│   ├── Topic.js            temas, enlaces, votos y criterio de orden
│   └── User.js             usuarios y hashing bcrypt
├── controllers/          CONTROLADOR — traduce HTTP a operaciones del modelo
│   ├── topicsController.js  linksController.js  votesController.js  authController.js
├── routes/index.js       mapa de URLs a controladores
├── middleware/           identity (votante + CSRF), auth, ownership, validate, flash, errorHandler
├── views/                VISTA — plantillas EJS (partials, topics, auth, error)
└── public/
    ├── js/app.js           TODO el frontend, en JavaScript puro
    └── css/app.css         Tailwind compilado
```

La regla que separa las capas: **el modelo no sabe que existe HTTP**, **la vista no
sabe que existe la base**, y **el controlador no calcula reglas de negocio**. El
criterio de orden por votos vive en `models/Topic.js` y en ningun otro lado.

## Rutas

| Metodo | Ruta | Que hace | Requiere |
|---|---|---|---|
| `GET` | `/` | listado ordenado por votos (`?q=` busca) | — |
| `GET` | `/topics/:id` | detalle con sus enlaces | — |
| `GET` | `/topics/new` | formulario de alta | sesion |
| `POST` | `/topics` | crear tema | sesion |
| `GET` | `/topics/:id/edit` | formulario de edicion | autor |
| `PUT` `PATCH` | `/topics/:id` | actualizar tema | autor |
| `DELETE` | `/topics/:id` | eliminar tema y sus enlaces | autor |
| `POST` | `/topics/:topicId/links` | agregar enlace | sesion |
| `PUT` `PATCH` | `/topics/:topicId/links/:linkId` | actualizar enlace | autor |
| `DELETE` | `/topics/:topicId/links/:linkId` | eliminar enlace | autor |
| `POST` | `/topics/:id/vote` | votar / quitar voto a un tema | — |
| `POST` | `/topics/:topicId/links/:linkId/vote` | votar / quitar voto a un enlace | — |
| `GET` `POST` | `/auth/login` `/auth/register` | sesion | — |
| `POST` | `/auth/logout` | cerrar sesion | — |
| `GET` | `/health` | estado del proceso | — |

Cada ruta responde **HTML o JSON** segun la cabecera `Accept`: el mismo endpoint
sirve al navegador sin JavaScript (redirect) y al `fetch` del frontend (JSON).

## Decisiones

**El conteo de votos se deriva, no se incrementa.** `votes` siempre vale
`voters.length`. Un doble click, un reintento de red o dos pestanas no pueden
inflar el contador: volver a votar quita el voto. Votar **no requiere cuenta**:
cada visitante recibe una cookie firmada con un id anonimo que es la clave de
deduplicacion. Borrar la cookie permite votar de nuevo, como en cualquier encuesta
sin login; lo que la firma impide es fabricar ids en un bucle.

**El orden lo decide el servidor, siempre.** La respuesta a un voto trae el orden
completo ya recalculado (`order: [...]`). El cliente no lo deduce del contador:
habria dos implementaciones del mismo criterio (mas votos primero; a empate, el mas
antiguo) y bastaria olvidar el desempate en una para que la lista quedara distinta
a la que se ve al recargar. El cliente solo mueve nodos, con animacion FLIP.

**La app funciona sin JavaScript.** Cada boton es un `<form>` real; `method-override`
traduce `?_method=PUT` a una request PUT de verdad. `public/js/app.js` intercepta
esos envios para evitar la recarga. `form.noValidate = true` se pone **desde JS**,
nunca en el HTML: sin el script, la validacion nativa del navegador sigue actuando;
con el, el navegador dejaria de disparar `submit` ante un campo invalido y los
mensajes propios nunca aparecerian.

**La validacion del cliente es comodidad; la del servidor es la que cuenta.**
`middleware/validate.js` revalida todo. El caso que mas importa: solo se aceptan
URLs `http:` y `https:`. Un `javascript:` guardado como enlace y puesto en un `href`
es XSS almacenado, y el escapado de EJS no lo detiene.

**Escritura atomica y cola de escrituras.** La base es un JSON escrito con temp +
rename, y todas las mutaciones pasan por una cola: `await` intercala requests y sin
la cola dos leer-modificar-escribir simultaneos perderian un cambio.

## Seguridad

| Riesgo | Que lo cubre |
|---|---|
| XSS reflejado | EJS escapa con `<%= %>` todas las salidas |
| XSS almacenado por URL | solo esquemas `http:` y `https:` |
| CSRF | token HMAC ligado a la identidad + `SameSite=Lax` |
| Fijacion de sesion | `session.regenerate()` al autenticar |
| Contrasenas | bcrypt, 10 rondas; el hash nunca sale del modelo |
| Enumeracion de usuarios | mismo mensaje y mismo tiempo ante usuario inexistente |
| Redirector abierto | el `next` del login solo admite rutas internas |
| Clickjacking / scripts ajenos | `X-Frame-Options: DENY`, CSP `script-src 'self'` |
| Exposicion en red | bind a `127.0.0.1` por defecto |

## Pruebas

`npm test` corre la suite de integracion contra la app real en un puerto efimero:
CRUD de temas y enlaces, idempotencia del voto, orden por votos en ambos niveles,
permisos por autor, registro y login, CSRF, y el camino sin JavaScript
(`?_method=PUT` por formulario).

## Requisitos del ejercicio

**Obligatorios:** servidor Express · rutas CRUD y de votos · manejo de GET/POST/PUT/
PATCH/DELETE · motor de plantillas EJS · CRUD de temas y de enlaces · boton de voto
para temas y enlaces · el servidor actualiza el conteo y reordena · la interfaz se
actualiza sin recargar · arquitectura MVC · JavaScript puro en el cliente.

**Opcionales:** Tailwind CSS (compilado, sin CDN) · autenticacion, y solo el autor
edita lo suyo · validaciones de cliente y de servidor.
