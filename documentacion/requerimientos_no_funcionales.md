# Requerimientos No Funcionales — Backend Pañalera

> **Proyecto:** Sistema de gestión de pañalera (backend)
> **Stack:** Node.js · Express · PostgreSQL · JWT · Jest
> **Fecha:** 14 de marzo de 2026
> **Versión:** 1.0

---

## Índice

1. [Requerimientos No Funcionales Globales](#1-requerimientos-no-funcionales-globales)
2. [Requerimientos No Funcionales Detallados](#2-requerimientos-no-funcionales-detallados)
   - [2.1 Performance](#21-performance)
   - [2.2 Escalabilidad](#22-escalabilidad)
   - [2.3 Seguridad](#23-seguridad)
   - [2.4 Confiabilidad](#24-confiabilidad)
   - [2.5 Mantenibilidad](#25-mantenibilidad)
   - [2.6 Usabilidad](#26-usabilidad)
3. [Casos No Funcionales Documentados](#3-casos-no-funcionales-documentados)
   - [NFR-001 – Tiempo de respuesta en pedidos](#nfr-001--tiempo-de-respuesta-en-pedidos)
   - [NFR-002 – Seguridad de endpoints protegidos](#nfr-002--seguridad-de-endpoints-protegidos)
   - [NFR-003 – Usabilidad de mensajes de error](#nfr-003--usabilidad-de-mensajes-de-error)
   - [NFR-004 – Confiabilidad ante caída de base de datos](#nfr-004--confiabilidad-ante-caída-de-base-de-datos)

---

## 1. Requerimientos No Funcionales Globales

El sistema debe cumplir con los siguientes atributos de calidad transversales a todos sus módulos:

- **Performance:** El sistema debe responder al 95% de las solicitudes en menos de 2 segundos bajo condiciones normales de uso, garantizando una experiencia fluida en los endpoints críticos (login, catálogo, pedidos).
- **Escalabilidad:** El sistema debe ser capaz de soportar múltiples usuarios concurrentes y un crecimiento sostenido en el volumen de productos y pedidos sin degradar significativamente su rendimiento.
- **Seguridad:** El acceso a recursos protegidos debe estar resguardado mediante JWT. Los roles deben restringir las acciones disponibles para cada tipo de usuario y los tokens deben expirar en el tiempo definido.
- **Confiabilidad:** El sistema debe manejar errores internos de forma controlada, devolviendo respuestas HTTP apropiadas sin exponer información sensible ni interrumpir el servicio ante fallos parciales.
- **Mantenibilidad:** El código debe estar organizado en una arquitectura modular y consistente, con pruebas automatizadas que validen los flujos de negocio y faciliten la incorporación de nuevas funcionalidades.
- **Usabilidad:** Las respuestas de la API deben estar en formato JSON consistente, con mensajes de error claros, específicos e informativos que orienten al cliente sobre la causa del problema.

---

## 2. Requerimientos No Funcionales Detallados

### 2.1 Performance

- El sistema debe responder al **95% de las solicitudes en menos de 2 segundos**, incluyendo los endpoints de login, catálogo de productos y creación de pedidos.
- Las consultas a la base de datos PostgreSQL deben estar optimizadas mediante el uso de **índices** en columnas de búsqueda frecuente: `email` (usuarios), `id_cliente` (pedidos), `stock` (productos).
- El servidor debe procesar las operaciones de acceso a la base de datos de forma **asincrónica**, evitando el bloqueo del event loop de Node.js.
- Los endpoints de listado (productos, pedidos) deben diseñarse considerando **paginación futura**, para evitar la transferencia de grandes volúmenes de datos en una sola respuesta.

---

### 2.2 Escalabilidad

- El sistema debe permitir el **crecimiento del catálogo de productos y el volumen de pedidos** sin requerir cambios estructurales en el código ni degradar significativamente el rendimiento.
- La arquitectura debe ser **stateless**: ningún estado de sesión debe almacenarse en el servidor. Toda la información de autenticación debe estar contenida en el token JWT, permitiendo escalar horizontalmente de ser necesario.
- La base de datos debe ejecutarse en un **proceso o servidor independiente** del backend, permitiendo escalar ambas capas por separado.
- La configuración del sistema (puerto, cadena de conexión, secreto JWT) debe gestionarse mediante **variables de entorno**, permitiendo despliegues en múltiples entornos sin modificar el código fuente.

---

### 2.3 Seguridad

- Los endpoints protegidos deben **rechazar solicitudes sin token JWT** válido, retornando `401 Unauthorized`.
- Los endpoints que requieren rol específico deben **rechazar accesos de roles no autorizados**, retornando `403 Forbidden`.
- El sistema debe validar la **expiración del token** en cada solicitud; un token vencido debe ser tratado como no válido.
- Las **contraseñas** deben almacenarse en la base de datos utilizando hashing con `bcrypt`, nunca en texto plano.
- Las credenciales sensibles (clave JWT, cadena de conexión a PostgreSQL) deben gestionarse exclusivamente mediante **variables de entorno** y no deben aparecer en el código fuente ni en el repositorio.
- El sistema debe utilizar **consultas parametrizadas** para interactuar con PostgreSQL, previniendo ataques de inyección SQL.
- Los mensajes de error ante fallos internos no deben exponer **detalles de la base de datos, rutas del sistema ni trazas de pila** al cliente.

---

### 2.4 Confiabilidad

- Ante una caída o fallo en la conexión a la base de datos, el sistema debe **retornar un error controlado** (`500 Internal Server Error`) sin interrumpir el proceso del servidor ni exponer información interna.
- El sistema debe contar con un **middleware global de manejo de errores** que capture excepciones no controladas y garantice respuestas HTTP consistentes en todos los escenarios de fallo.
- Los **tests automatizados con Jest** deben cubrir los principales flujos de negocio: autenticación, creación de pedidos, validaciones de stock y cambio de estado.
- Cada test debe ser **independiente y autocontenido**: no debe depender del estado dejado por otros tests ni de un orden de ejecución específico.
- En entornos de producción, el proceso del servidor debe ser gestionado por un **administrador de procesos** (como PM2) que garantice el reinicio automático ante caídas inesperadas.

---

### 2.5 Mantenibilidad

- El proyecto debe estar organizado en una **arquitectura modular por capas**, separando claramente:
  - `routes/` — definición de rutas y métodos HTTP.
  - `controllers/` — lógica de negocio y manejo de la solicitud/respuesta.
  - `middlewares/` — autenticación, autorización y manejo de errores.
  - `models/` o `queries/` — acceso y consultas a la base de datos.
- Cada módulo de dominio (usuarios, productos, pedidos) debe tener sus propios archivos de rutas y controlador, evitando la concentración de lógica en un único archivo.
- El código debe seguir **convenciones de nomenclatura uniformes**: `camelCase` para variables y funciones, nombres descriptivos para controladores y middlewares.
- Los **tests deben ser fácilmente extensibles**: agregar nuevos casos de prueba no debe requerir modificar la estructura existente de los archivos de test.
- Los **mensajes de error deben estar centralizados** o ser constantes reutilizables, evitando cadenas de texto duplicadas en múltiples controladores.

---

### 2.6 Usabilidad

- Todos los mensajes de error deben ser **claros, específicos e informativos**, orientados a que el cliente de la API comprenda la causa del problema sin necesidad de inspeccionar el servidor. Ejemplos implementados:
  - `"Stock insuficiente"` — cuando la cantidad solicitada supera el stock disponible.
  - `"La cantidad debe ser mayor a 0"` — cuando se envía una cantidad negativa o igual a cero.
  - `"Debe especificar id_cliente"` — cuando el dueño crea un pedido sin asociarlo a un cliente.
  - `"Estado inválido"` — cuando se intenta asignar un estado fuera de los valores permitidos.
- Todas las respuestas de la API deben estar en **formato JSON consistente**, incluyendo tanto los casos de éxito como los de error.
- El endpoint de catálogo público debe devolver **únicamente productos con `stock > 0`** e incluir el campo `precio_venta`, ocultando campos internos como `precio_compra`.
- Los códigos de estado HTTP deben ser **semánticamente correctos** y coherentes con el tipo de respuesta:
  - `200 OK` — solicitud exitosa.
  - `201 Created` — recurso creado correctamente.
  - `400 Bad Request` — error de validación o datos incorrectos.
  - `401 Unauthorized` — token ausente o inválido.
  - `403 Forbidden` — rol sin permisos suficientes.
  - `404 Not Found` — recurso inexistente.
  - `500 Internal Server Error` — fallo interno del servidor.

---

## 3. Casos No Funcionales Documentados

---

### NFR-001 – Tiempo de respuesta en pedidos

**Nombre del caso:** Verificación de tiempo de respuesta en el endpoint de creación de pedidos

---

**Objetivo:**
Validar que el endpoint `POST /pedidos` responda dentro del umbral de rendimiento aceptable (menos de 2 segundos), garantizando una experiencia de uso fluida bajo condiciones normales de carga.

---

**Precondiciones:**

- El servidor backend se encuentra en ejecución en entorno local o de staging.
- La base de datos PostgreSQL está operativa y contiene datos de prueba.
- El usuario está autenticado y dispone de un token JWT válido.
- Existe al menos un producto con stock disponible.

---

**Procedimiento:**

1. Registrar el tiempo de inicio antes de enviar la solicitud.
2. Enviar una solicitud `POST /pedidos` con un producto y cantidad válidos.
3. Registrar el tiempo de finalización al recibir la respuesta.
4. Calcular el tiempo total de respuesta (fin - inicio).
5. Verificar que el tiempo calculado sea inferior a 2000 ms.

---

**Resultado esperado:**

- Código de estado: `201 Created`.
- Tiempo de respuesta: **menor a 2000 ms**.
- El pedido queda registrado correctamente en la base de datos.

---

**Resultado obtenido:**

- Código de estado: `201 Created`.
- Tiempo de respuesta observado: dentro del umbral aceptable en condiciones normales de uso local.

---

**Conclusión:**

El sistema cumple con el requerimiento de performance bajo condiciones normales. Para garantizar este umbral en producción con carga concurrente real, se recomienda agregar índices en `id_cliente` dentro de la tabla de pedidos y evaluar el comportamiento con herramientas de carga como Artillery o k6.

---

### NFR-002 – Seguridad de endpoints protegidos

**Nombre del caso:** Rechazo de acceso a endpoints protegidos sin token JWT válido

---

**Objetivo:**
Validar que el sistema rechace correctamente las solicitudes dirigidas a endpoints protegidos cuando no se incluye un token JWT o el token proporcionado es inválido o ha expirado.

---

**Precondiciones:**

- El servidor backend se encuentra en ejecución.
- El middleware de autenticación está aplicado sobre los endpoints protegidos.

---

**Procedimiento:**

1. Enviar una solicitud `GET /pedidos` **sin encabezado** `Authorization`.
2. Verificar el código de estado y el mensaje de la respuesta.
3. Enviar una solicitud `GET /pedidos` con un token **malformado** o **expirado**.
4. Verificar el código de estado y el mensaje de la respuesta.
5. Enviar una solicitud `GET /pedidos` con un token válido de rol `cliente` a un endpoint exclusivo del `dueño`.
6. Verificar que el sistema retorne `403 Forbidden`.

---

**Resultado esperado:**

- Sin token: `401 Unauthorized`.
- Token inválido o expirado: `401 Unauthorized`.
- Token válido con rol incorrecto: `403 Forbidden`.
- En ningún caso el sistema debe devolver datos del recurso solicitado.

---

**Resultado obtenido:**

- El middleware de autenticación rechaza correctamente las solicitudes sin token o con token inválido con `401 Unauthorized`.
- El middleware de autorización rechaza accesos de roles no permitidos con `403 Forbidden`.

---

**Conclusión:**

El sistema cumple con los requerimientos de seguridad para autenticación y autorización basada en roles. El uso de JWT con validación en middleware centralizado garantiza una protección consistente sobre todos los endpoints registrados con dicho middleware.

---

### NFR-003 – Usabilidad de mensajes de error

**Nombre del caso:** Claridad e informatividad de los mensajes de error en validaciones de pedidos

---

**Objetivo:**
Validar que los mensajes de error retornados por el sistema ante datos inválidos en la creación de pedidos sean claros, específicos y orientados al cliente de la API, sin exponer detalles internos del servidor.

---

**Precondiciones:**

- El servidor backend se encuentra en ejecución.
- El usuario está autenticado con un token JWT válido.
- Existen productos registrados en la base de datos.

---

**Procedimiento:**

1. Enviar `POST /pedidos` con `cantidad = -1`. Verificar el mensaje de error.
2. Enviar `POST /pedidos` con una cantidad mayor al stock disponible. Verificar el mensaje de error.
3. Enviar `POST /pedidos` como dueño sin incluir `id_cliente`. Verificar el mensaje de error.
4. Enviar `PATCH /pedidos/:id/estado` con un estado no permitido. Verificar el mensaje de error.
5. En cada caso, verificar que el mensaje sea descriptivo y no incluya trazas de pila ni SQL.

---

**Resultado esperado:**

| Escenario | Código | Mensaje esperado |
|-----------|--------|-----------------|
| Cantidad negativa o cero | `400` | `"La cantidad debe ser mayor a 0"` |
| Stock insuficiente | `400` | `"Stock insuficiente"` |
| Dueño sin id_cliente | `400` | `"Debe especificar id_cliente"` |
| Estado inválido | `400` | `"Estado inválido"` |

---

**Resultado obtenido:**

- Todos los mensajes de error retornados por el sistema coinciden con los esperados.
- Las respuestas están en formato JSON consistente: `{ "mensaje": "..." }`.
- Ninguna respuesta expone información interna del servidor o de la base de datos.

---

**Conclusión:**

El sistema cumple con el requerimiento de usabilidad en el manejo de errores. Los mensajes implementados son específicos, accionables y alineados con el dominio del negocio, lo que facilita la integración por parte de clientes frontend o consumidores de la API.

---

### NFR-004 – Confiabilidad ante caída de base de datos

**Nombre del caso:** Manejo controlado de errores ante fallo en la conexión a PostgreSQL

---

**Objetivo:**
Validar que el sistema responda de forma controlada y estable ante una falla en la conexión a la base de datos, sin interrumpir el proceso del servidor ni exponer información interna al cliente.

---

**Precondiciones:**

- El servidor backend se encuentra en ejecución.
- Se puede simular una caída de la base de datos (deteniendo el servicio de PostgreSQL o configurando credenciales incorrectas temporalmente).

---

**Procedimiento:**

1. Detener el servicio de PostgreSQL o interrumpir la conexión a la base de datos.
2. Enviar una solicitud a cualquier endpoint que requiera acceso a la base de datos (por ejemplo, `GET /productos/catalogo`).
3. Verificar el código de estado HTTP de la respuesta.
4. Verificar que el cuerpo de la respuesta no contenga trazas de pila, nombres de tablas ni mensajes internos de PostgreSQL.
5. Verificar que el proceso del servidor Node.js siga en ejecución y pueda responder nuevas solicitudes.

---

**Resultado esperado:**

- Código de estado: `500 Internal Server Error`.
- Cuerpo: mensaje genérico de error sin detalles internos (por ejemplo, `{ "mensaje": "Error interno del servidor" }`).
- El proceso del servidor **no debe caerse** ni dejar de responder.

---

**Resultado obtenido:**

- El middleware global de manejo de errores captura la excepción generada por el fallo de conexión y retorna `500 Internal Server Error` con un mensaje genérico.
- El servidor continúa en ejecución y responde correctamente una vez restablecida la conexión.

---

**Conclusión:**

El sistema cumple con el requerimiento de confiabilidad ante fallos parciales de infraestructura. El middleware centralizado de manejo de errores actúa como red de seguridad, garantizando que ninguna excepción no controlada llegue al cliente con información sensible ni detenga el proceso del servidor.

---

## Resumen de Requerimientos No Funcionales

| Categoría | Cantidad de RNF | Estado |
|-----------|----------------|--------|
| Performance | 4 | ✅ Definidos |
| Escalabilidad | 4 | ✅ Definidos |
| Seguridad | 6 | ✅ Definidos |
| Confiabilidad | 5 | ✅ Definidos |
| Mantenibilidad | 5 | ✅ Definidos |
| Usabilidad | 4 | ✅ Definidos |
| **Total** | **28** | ✅ |

---

*Documentación de requerimientos no funcionales — Backend Pañalera — v1.0*
