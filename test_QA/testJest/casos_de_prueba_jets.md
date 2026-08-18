# Documentación de Casos de Prueba — Proyecto Backend

> **Estándar aplicado:** ISBP (International Standard Banking Practice)
> **Módulos cubiertos:** Productos y Pedidos
> **Fecha de documentación:** 14 de marzo de 2026

---

## Índice

| ID | Nombre del Caso | Módulo | Estado |
|----|-----------------|--------|--------|
| [TC-PROD-001](#tc-prod-001) | Catálogo público de productos | Productos | ✅ Corregido |
| [TC-PED-001](#tc-ped-001) | Crear pedido con stock insuficiente | Pedidos | ✅ Corregido |
| [TC-PED-002](#tc-ped-002) | Crear pedido con cantidad negativa | Pedidos | ✅ Corregido |
| [TC-PED-003](#tc-ped-003) | Dueño crea pedido sin `id_cliente` | Pedidos | ✅ Corregido |
| [TC-PED-004](#tc-ped-004) | Cambio de estado inválido en pedido | Pedidos | ✅ Corregido |

---

## Módulo: Productos

---

### TC-PROD-001

**Nombre del caso:** Catálogo público de productos

---

**Objetivo:**
Validar que un cliente autenticado pueda consultar el catálogo de productos y recibir únicamente aquellos con stock mayor a 0, incluyendo el campo `precio_venta` en la respuesta.

---

**Precondiciones:**

- El servidor backend se encuentra en ejecución.
- Existe al menos un producto en la base de datos con `stock > 0`.
- El endpoint `/productos/catalogo` debería estar disponible de forma pública o para clientes autenticados.

---

**Procedimiento:**

1. Enviar una solicitud HTTP `GET` al endpoint `/productos/catalogo`.
2. Verificar el código de estado HTTP de la respuesta.
3. Verificar que el cuerpo de la respuesta sea un array de productos.
4. Verificar que cada producto en el array contenga el campo `precio_venta`.
5. Verificar que ningún producto retornado tenga `stock <= 0`.

---

**Resultado esperado:**

- Código de estado: `200 OK`
- Cuerpo: array de objetos producto, cada uno con el campo `precio_venta`.
- Solo se listan productos con `stock > 0`.

---

**Resultado obtenido:**

- Código de estado: `404 Not Found`
- Cuerpo: respuesta de error indicando que el recurso no fue encontrado.

---

**Conclusión:**

**Falla del sistema detectada:** El endpoint `/productos/catalogo` no estaba implementado en el router del backend, por lo que cualquier solicitud dirigida a dicha ruta retornaba un error `404 Not Found`.

**Corrección aplicada:** Se registró la ruta pública `GET /productos/catalogo` en el archivo de rutas correspondiente y se implementó el controlador `listarCatalogo`, el cual consulta la base de datos filtrando productos con `stock > 0` y retorna el campo `precio_venta` en cada objeto de la respuesta.

---

## Módulo: Pedidos

---

### TC-PED-001

**Nombre del caso:** Crear pedido con stock insuficiente

---

**Objetivo:**
Validar que el sistema rechace la creación de un pedido cuando la cantidad solicitada por el cliente supera el stock disponible del producto, retornando un error claro e informativo.

---

**Precondiciones:**

- El servidor backend se encuentra en ejecución.
- Existe al menos un producto en la base de datos con stock conocido (por ejemplo, `stock = 2`).
- El usuario está autenticado con rol `cliente`.

---

**Procedimiento:**

1. Identificar un producto con stock limitado (por ejemplo, `stock = 2`).
2. Enviar una solicitud HTTP `POST` al endpoint `/pedidos` con una cantidad mayor al stock disponible (por ejemplo, `cantidad = 10`).
3. Verificar el código de estado HTTP de la respuesta.
4. Verificar que el mensaje de error en el cuerpo sea `"Stock insuficiente"`.

---

**Resultado esperado:**

- Código de estado: `400 Bad Request`
- Cuerpo: `{ "mensaje": "Stock insuficiente" }`
- El pedido no debe registrarse en la base de datos.

---

**Resultado obtenido:**

- Código de estado: `200 OK`
- El pedido fue creado exitosamente, ignorando la restricción de stock.

---

**Conclusión:**

**Falla del sistema detectada:** El controlador `crearPedido` no realizaba ninguna validación del stock disponible antes de insertar el pedido en la base de datos. Esto permitía crear pedidos con cantidades arbitrarias, comprometiendo la integridad del inventario.

**Corrección aplicada:** Se incorporó una validación en `crearPedido` que, previo a la inserción, consulta el stock actual del producto (`prod.stock`) y lo compara con la cantidad solicitada (`p.cantidad`). Si `p.cantidad > prod.stock`, la función retorna un error `400 Bad Request` con el mensaje `"Stock insuficiente"`.

---

### TC-PED-002

**Nombre del caso:** Crear pedido con cantidad negativa o igual a cero

---

**Objetivo:**
Validar que el sistema rechace la creación de un pedido cuando la cantidad indicada es menor o igual a cero, garantizando la integridad de los datos ingresados.

---

**Precondiciones:**

- El servidor backend se encuentra en ejecución.
- El usuario está autenticado con rol `cliente`.
- Existe al menos un producto disponible en la base de datos.

---

**Procedimiento:**

1. Enviar una solicitud HTTP `POST` al endpoint `/pedidos` con `cantidad = 0` o `cantidad = -1`.
2. Verificar el código de estado HTTP de la respuesta.
3. Verificar que el cuerpo de la respuesta contenga el mensaje `"La cantidad debe ser mayor a 0"`.
4. Confirmar que el pedido no fue registrado en la base de datos.

---

**Resultado esperado:**

- Código de estado: `400 Bad Request`
- Cuerpo: `{ "mensaje": "La cantidad debe ser mayor a 0" }`
- El pedido no debe registrarse en la base de datos.

---

**Resultado obtenido:**

- Código de estado: `200 OK`
- El pedido fue creado con cantidad inválida (`0` o negativa).

---

**Conclusión:**

**Falla del sistema detectada:** El controlador `crearPedido` no contaba con ninguna validación para cantidades menores o iguales a cero. Esto permitía la inserción de pedidos con datos semánticamente inválidos, afectando la consistencia del modelo de negocio.

**Corrección aplicada:** Se agregó una validación temprana en `crearPedido` que verifica si `p.cantidad <= 0` antes de cualquier operación sobre la base de datos. En caso de cumplirse la condición, el sistema retorna un error `400 Bad Request` con el mensaje `"La cantidad debe ser mayor a 0"`.

---

### TC-PED-003

**Nombre del caso:** Dueño crea pedido sin especificar `id_cliente`

---

**Objetivo:**
Validar que cuando un usuario con rol `dueño` intenta crear un pedido en nombre de un cliente, el sistema exija el campo `id_cliente` y lo rechace en caso de ausencia, evitando pedidos sin cliente asociado.

---

**Precondiciones:**

- El servidor backend se encuentra en ejecución.
- El usuario está autenticado con rol `dueño`.
- Existe al menos un producto disponible en la base de datos.

---

**Procedimiento:**

1. Enviar una solicitud HTTP `POST` al endpoint `/pedidos` con el token de un usuario con rol `dueño`.
2. Omitir el campo `id_cliente` en el cuerpo de la solicitud.
3. Verificar el código de estado HTTP de la respuesta.
4. Verificar que el cuerpo contenga el mensaje `"Debe especificar id_cliente"`.
5. Confirmar que el pedido no fue registrado en la base de datos.

---

**Resultado esperado:**

- Código de estado: `400 Bad Request`
- Cuerpo: `{ "mensaje": "Debe especificar id_cliente" }`
- El pedido no debe registrarse en la base de datos.

---

**Resultado obtenido:**

- Código de estado: `200 OK`
- El pedido fue creado sin ningún cliente asociado.

---

**Conclusión:**

**Falla del sistema detectada:** El controlador `crearPedido` no diferenciaba el comportamiento según el rol del usuario autenticado. Al omitir `id_cliente`, el pedido se insertaba sin asociación a ningún cliente, generando registros huérfanos e inconsistentes en la base de datos.

**Corrección aplicada:** Se incorporó en `crearPedido` una validación condicional basada en el rol del usuario: si el rol es `dueño` y no se proporciona `id_cliente` en el cuerpo de la solicitud, el sistema retorna un error `400 Bad Request` con el mensaje `"Debe especificar id_cliente"`.

---

### TC-PED-004

**Nombre del caso:** Cambio de estado inválido en pedido

---

**Objetivo:**
Validar que el sistema restrinja los valores permitidos al actualizar el estado de un pedido, aceptando únicamente: `pendiente`, `confirmado`, `entregado` y `cancelado`, y rechazando cualquier otro valor.

---

**Precondiciones:**

- El servidor backend se encuentra en ejecución.
- El usuario está autenticado con rol `dueño`.
- Existe al menos un pedido registrado en la base de datos.

---

**Procedimiento:**

1. Enviar una solicitud HTTP `PATCH` o `PUT` al endpoint de actualización de estado del pedido (por ejemplo, `/pedidos/:id/estado`).
2. Incluir en el cuerpo un valor de estado no permitido (por ejemplo, `"estado": "procesando"`).
3. Verificar el código de estado HTTP de la respuesta.
4. Verificar que el cuerpo contenga el mensaje `"Estado inválido"`.
5. Confirmar que el estado del pedido no fue modificado en la base de datos.

---

**Resultado esperado:**

- Código de estado: `400 Bad Request`
- Cuerpo: `{ "mensaje": "Estado inválido" }`
- El estado del pedido no debe modificarse en la base de datos.

---

**Resultado obtenido:**

- Código de estado: `200 OK`
- El estado del pedido fue actualizado con el valor no permitido.

---

**Conclusión:**

**Falla del sistema detectada:** El controlador `cambiarEstado` aceptaba cualquier valor en el campo `estado` sin validar que perteneciera al conjunto de valores permitidos por el modelo de negocio. Esto habilitaba la persistencia de estados arbitrarios, comprometiendo la coherencia del flujo de gestión de pedidos.

**Corrección aplicada:** Se incorporó en `cambiarEstado` una validación que comprueba si el valor recibido pertenece al conjunto de estados válidos: `['pendiente', 'confirmado', 'entregado', 'cancelado']`. Si el valor no está incluido, el sistema retorna un error `400 Bad Request` con el mensaje `"Estado inválido"`.

---

## Resumen de Fallas Detectadas y Correcciones

| ID | Falla del Sistema | Corrección Aplicada |
|----|-------------------|---------------------|
| TC-PROD-001 | Endpoint `/productos/catalogo` inexistente | Se implementó ruta y controlador `listarCatalogo` |
| TC-PED-001 | Sin validación de stock antes de crear pedido | Se agregó comparación `prod.stock` vs `p.cantidad` |
| TC-PED-002 | Sin validación de cantidad negativa o cero | Se agregó verificación `p.cantidad <= 0` |
| TC-PED-003 | Sin validación de `id_cliente` para rol dueño | Se agregó control condicional por rol en `crearPedido` |
| TC-PED-004 | Sin restricción de estados válidos en pedidos | Se agregó whitelist de estados en `cambiarEstado` |

---

*Documentación generada bajo el estándar ISBP — Proyecto Backend*
