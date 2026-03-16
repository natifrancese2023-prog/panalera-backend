
Procedimiento de Prueba (IEEE 29119-3)
Procedimiento: Autenticación Básica
Casos cubiertos: CP-LOGIN-001, CP-LOGIN-002, CP-LOGIN-003

Entorno: QA (base de datos inicializada con usuarios de prueba)

Preparación: limpiar cookies/cache; crear usuario válido en BD

Pasos de Ejecución

Abrir Postman.

Seleccionar request POST /auth/login.

Ingresar credenciales según datos del caso.

Enviar request.

Validar resultado esperado (status code, token o mensaje de error).

Criterios de éxito: coincide con resultado esperado, sin errores de consola ni respuestas inesperadas.

Procedimiento: Gestión de Productos
Casos cubiertos: CP-PROD-001, CP-PROD-002, CP-PROD-003, CP-PROD-004

Entorno: QA (usuario admin autenticado)

Preparación: crear al menos un producto válido en BD

Pasos de Ejecución

Abrir Postman.

Seleccionar request correspondiente (POST, PUT, DELETE /productos).

Ingresar datos según caso (válidos/ inválidos).

Enviar request.

Validar resultado esperado (status code, objeto producto o mensaje de error).

Criterios de éxito: CRUD responde según especificación, sin inconsistencias en BD.

Procedimiento: Gestión de Pedidos
Casos cubiertos: CP-PED-001, CP-PED-002, CP-PED-003, CP-PED-004

Entorno: QA (usuario autenticado con token válido)

Preparación: tener al menos un producto disponible para pedidos

Pasos de Ejecución

Abrir Postman.

Seleccionar request correspondiente (GET, POST /pedidos).

Configurar header Authorization según caso (con token / sin token).

Ingresar datos de pedido según caso.

Enviar request.

Validar resultado esperado (status code, lista de pedidos o error).

Criterios de éxito: pedidos válidos se crean y listan correctamente; pedidos inválidos son rechazados.


ID Caso	Fecha	Tester	Entorno	Resultado	Evidencia (link)	Observaciones

CP-LOGIN-001	AAAA-MM-DD	QA1	QA	Pendiente	/evidencias/cp-login-001.png	—

CP-LOGIN-002	AAAA-MM-DD	QA1	QA	Pendiente	/evidencias/cp-login-002.png	—

CP-LOGIN-003	AAAA-MM-DD	QA1	QA	Pendiente	/evidencias/cp-login-003.png	—

CP-PROD-001	AAAA-MM-DD	QA1	QA	Pendiente	/evidencias/cp-prod-001.png	—

CP-PROD-002	AAAA-MM-DD	QA1	QA	Pendiente	/evidencias/cp-prod-002.png	—

CP-PROD-003	AAAA-MM-DD	QA1	QA	Pendiente	/evidencias/cp-prod-003.png	—

CP-PROD-004	AAAA-MM-DD	QA1	QA	Pendiente	/evidencias/cp-prod-004.png	—

CP-PED-001	AAAA-MM-DD	QA1	QA	Pendiente	/evidencias/cp-ped-001.png	—

CP-PED-002	AAAA-MM-DD	QA1	QA	Pendiente	/evidencias/cp-ped-002.png	—

CP-PED-003	AAAA-MM-DD	QA1	QA	Pendiente	/evidencias/cp-ped-003.png	—

CP-PED-004	AAAA-MM-DD	QA1	QA	Pendiente	/evidencias/cp-ped-004.png	—
2. Indicadores (Resumen)
Ejecutados: …

OK: … | Fallas: … | Bloqueados: …

% Éxito: …

3. Notas
Cambios de alcance: …

Ambientes caídos: …

Datos corruptos: …

Otros incidentes: …

Ejemplo aplicado
INC-LOGIN-001

Fecha: 2026-03-11

Tester: QA1

Entorno: QA

Caso relacionado: CP-LOGIN-002

Título: Login inválido devuelve 500 en lugar de 401

Detalle: se envió {email:"test@test.com", password:"wrong"} → respuesta 500 Internal Server Error.

Resultado esperado: 401 Unauthorized.

Resultado real: 500 Internal Server Error.

Severidad: Crítica

Prioridad: Alta

Estado: Nuevo

Evidencia: /evidencias/inc-login-001.mp4

Impacto: usuarios no reciben feedback correcto, riesgo de seguridad.

Observaciones: ambiente QA estable, error reproducible en DEV.
