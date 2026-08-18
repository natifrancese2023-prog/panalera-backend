# Registro de Incidentes — API Pañalera
**Estándar:** IEEE 29119-3  
**Versión:** 1.0  
**Fecha:** 2026-03-12

---

## Convenciones

| Campo | Valores posibles |
|---|---|
| Severidad | Crítica / Alta / Media / Baja |
| Prioridad | Alta / Media / Baja |
| Estado | Nuevo / Asignado / En corrección / Verificado / Cerrado / Reabierto |

**Flujo de estados:**  
`Nuevo` → `Asignado` → `En corrección` → `Verificado` → `Cerrado`  
En caso de rechazo: `Verificado` → `Reabierto` → `En corrección`

---

## INC-001 — Login inválido devuelve 500 en lugar de 401

| Campo | Detalle |
|---|---|
| **ID** | INC-001 |
| **Fecha de detección** | 2026-03-11 |
| **Tester** | QA1 |
| **Entorno** | QA |
| **Caso relacionado** | CP-LOGIN-002 |
| **Severidad** | Crítica |
| **Prioridad** | Alta |
| **Estado** | Cerrado |
| **Evidencia** | `/evidencias/inc-001.mp4` |

**Título:** Login inválido devuelve 500 en lugar de 401

**Descripción:**  
Al enviar una request `POST /auth/login` con un password incorrecto, el servidor responde con `500 Internal Server Error` en lugar del esperado `401 Unauthorized`.

**Pasos para reproducir:**
1. Enviar `POST /auth/login` con body:
   ```json
   {
     "email": "nati@mail.com",
     "contrasena": "wrong"
   }
   ```
2. Observar la respuesta del servidor.

**Resultado esperado:** `401 Unauthorized` con body `{"error": "Credenciales inválidas"}`.

**Resultado real:** `500 Internal Server Error`. El body contenía un stack trace interno.

**Impacto:** El usuario no recibe feedback correcto sobre sus credenciales. Exposición potencial de información interna del servidor en el mensaje de error. Riesgo de seguridad.

**Observaciones:** Reproducible en entorno QA y DEV. El error ocurría cuando la consulta a BD devolvía `null` por usuario no encontrado y el controlador no manejaba ese caso. Corregido en commit `a3f2c1d`.

**Verificación:** 2026-03-12 — QA1 ejecutó CP-LOGIN-002 nuevamente. Status code correcto (401). Cerrado.

---

## INC-002 — DELETE producto con pedidos asociados devuelve 500 en lugar de 409

| Campo | Detalle |
|---|---|
| **ID** | INC-002 |
| **Fecha de detección** | 2026-03-12 |
| **Tester** | QA1 |
| **Entorno** | QA |
| **Caso relacionado** | CP-PROD-006 |
| **Severidad** | Alta |
| **Prioridad** | Alta |
| **Estado** | Asignado |
| **Evidencia** | `/evidencias/inc-002.png` |

**Título:** DELETE de producto con pedidos asociados devuelve 500 en lugar de 409 Conflict

**Descripción:**  
Al intentar eliminar un producto que tiene registros en la tabla `detalle_pedido`, el servidor devuelve `500 Internal Server Error` en lugar del esperado `409 Conflict`.

**Pasos para reproducir:**
1. Verificar que el producto con ID 1 tiene pedidos asociados en `detalle_pedido`.
2. Autenticarse como dueño y obtener token.
3. Enviar `DELETE /productos/1` con header `Authorization: Bearer {token}`.
4. Observar la respuesta.

**Resultado esperado:** `409 Conflict` con body `{"error": "No se puede eliminar: el producto está asociado a pedidos"}`.

**Resultado real:** `500 Internal Server Error`. El error de integridad referencial de PostgreSQL no está siendo manejado por el controlador; se propaga como excepción no controlada.

**Impacto:** Comportamiento no definido expuesto al cliente. En producción, un 500 puede ocultar errores de BD y dificultar el diagnóstico. El producto no es eliminado (la operación falla en BD), pero el cliente no recibe información útil.

**Observaciones:** El constraint de FK en PostgreSQL previene la eliminación, pero el backend no captura la excepción específica (`ForeignKeyViolation`) y devuelve 500 genérico. Requiere manejo explícito en el controlador de productos.

**Asignado a:** Dev backend — pendiente de corrección en sprint 2.
