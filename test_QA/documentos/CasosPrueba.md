

Casos de Prueba (IEEE 29119-3)
1. Convenciones
Estado: Pendiente / Ejecutado / Bloqueado

Resultado: OK / Falla

Severidad (si falla): Crítica / Alta / Media / Baja

2. Tabla de Casos
🔐 Módulo Login
ID Caso	Título	Precondiciones	Pasos de Ejecución	Datos	Resultado Esperado	Trazabilidad (REQ/CPD)
CP-LOGIN-001	Login válido	Usuario activo en BD	1) Abrir Postman. 2) Enviar POST /auth/login con credenciales correctas.	{email:"test@test.com", password:"123456"}	200 OK, JSON con propiedad token.	REQ-001, CPD-LOGIN-001
CP-LOGIN-002	Login inválido	Usuario existente	1) Abrir Postman. 2) Enviar POST /auth/login con password incorrecto.	{email:"test@test.com", password:"wrong"}	401 Unauthorized.	REQ-002, CPD-LOGIN-002
CP-LOGIN-003	Login sin datos	Usuario existente	1) Abrir Postman. 2) Enviar POST /auth/login con body vacío.	{}	400 Bad Request.	REQ-002, CPD-LOGIN-003
📦 Módulo Productos
ID Caso	Título	Precondiciones	Pasos de Ejecución	Datos	Resultado Esperado	Trazabilidad (REQ/CPD)
CP-PROD-001	Crear producto válido	Usuario admin autenticado	1) Enviar POST /productos con datos correctos.	{nombre:"pañal", precio:100}	201 Created, objeto producto.	REQ-005, CPD-PROD-001
CP-PROD-002	Crear producto inválido	Usuario admin autenticado	1) Enviar POST /productos con datos inválidos.	{nombre:"", precio:-10}	400 Bad Request.	REQ-005, CPD-PROD-002
CP-PROD-003	Actualizar producto existente	Producto creado previamente	1) Enviar PUT /productos/1 con datos válidos.	{precio:120}	200 OK, producto actualizado.	REQ-005, CPD-PROD-003
CP-PROD-004	Eliminar producto inexistente	Usuario admin autenticado	1) Enviar DELETE /productos/999.	N/A	404 Not Found.	REQ-005, CPD-PROD-004
🛒 Módulo Pedidos
ID Caso	Título	Precondiciones	Pasos de Ejecución	Datos	Resultado Esperado	Trazabilidad (REQ/CPD)
CP-PED-001	Obtener pedidos con token válido	Usuario autenticado	1) Enviar GET /pedidos con header Authorization: Bearer token.	N/A	200 OK, lista de pedidos.	REQ-003, CPD-PED-001
CP-PED-002	Obtener pedidos sin token	Usuario existente	1) Enviar GET /pedidos sin header.	N/A	403 Forbidden.	REQ-003, CPD-PED-002
CP-PED-003	Crear pedido válido	Usuario autenticado	1) Enviar POST /pedidos con datos correctos.	{producto:"pañal", cantidad:2}	201 Created, objeto pedido.	REQ-004, CPD-PED-003
CP-PED-004	Crear pedido inválido	Usuario autenticado	1) Enviar POST /pedidos con cantidad negativa.	{producto:"pañal", cantidad:-1}	400 Bad Request.	REQ-004, CPD-PED-
