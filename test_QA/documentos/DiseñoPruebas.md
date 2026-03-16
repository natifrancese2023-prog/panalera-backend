


Diseño de Pruebas (IEEE 29119-3)
1. Alcance y Objetivos
Módulos:

Autenticación (Login).

Gestión de Productos (crear, listar, actualizar, eliminar).

Gestión de Pedidos (crear, listar, actualizar, eliminar).

Objetivo: Validar que la API cumpla con los requisitos funcionales y de seguridad básica mediante pruebas de caja negra.

2. Trazabilidad a Requisitos
ID Requisito	Descripción	Riesgo	Condiciones de Prueba (alto nivel)
REQ-001	El sistema debe permitir login con credenciales válidas	Alto	CPD-LOGIN-001
REQ-002	El sistema debe rechazar login inválido	Alto	CPD-LOGIN-002
REQ-003	El sistema debe permitir acceso a pedidos solo con token válido	Alto	CPD-PED-001, CPD-PED-002
REQ-004	El sistema debe validar datos de pedidos (cantidad positiva)	Medio	CPD-PED-003, CPD-PED-004
REQ-005	El sistema debe permitir CRUD de productos	Alto	CPD-PROD-001, CPD-PROD-002, CPD-PROD-003, CPD-PROD-004
3. Técnicas de Diseño Seleccionadas
Partición de equivalencia: entradas válidas vs inválidas (ejemplo: cantidad positiva vs negativa).

Valores límite: cantidad = 0, cantidad = 1, cantidad máxima permitida.

Tablas de decisión: login (credenciales correctas/incorrectas, token presente/ausente).

Pruebas de estados: flujo de pedido (creado → actualizado → eliminado).

Combinación de condiciones: CRUD de productos con diferentes roles (admin vs usuario).

4. Condiciones de Prueba
Login
ID Condición	Descripción	Datos de prueba requeridos	Cobertura esperada
CPD-LOGIN-001	Login con credenciales válidas	Usuario registrado	Token válido
CPD-LOGIN-002	Login con credenciales inválidas	Usuario con password incorrecto	401 Unauthorized
CPD-LOGIN-003	Login sin datos	Body vacío	400 Bad Request
Productos
ID Condición	Descripción	Datos de prueba requeridos	Cobertura esperada
CPD-PROD-001	Crear producto válido	{nombre:"pañal", precio:100}	201 Created
CPD-PROD-002	Crear producto inválido	{nombre:"", precio:-10}	400 Bad Request
CPD-PROD-003	Actualizar producto existente	PUT /productos/1	200 OK
CPD-PROD-004	Eliminar producto inexistente	DELETE /productos/999	404 Not Found
Pedidos
ID Condición	Descripción	Datos de prueba requeridos	Cobertura esperada
CPD-PED-001	Obtener pedidos con token válido	Token generado en login	Lista de pedidos
CPD-PED-002	Obtener pedidos sin token	Request sin header Authorization	403 Forbidden
CPD-PED-003	Crear pedido válido	{producto:"pañal", cantidad:2}	201 Created
CPD-PED-004	Crear pedido inválido	{producto:"pañal", cantidad:-1}	400 Bad Request
5. Criterios de Aceptación por Módulo
Login: debe devolver token válido en ≤ 300 ms.

Productos: CRUD completo debe funcionar con validaciones correctas.

Pedidos: debe rechazar datos inválidos y aceptar válidos con precisión 100%.

Autorización: ningún acceso sin token debe ser permitido.

6. Dependencias y Supuestos
APIs externas: ninguna.

Supuestos: base de datos inicializada con usuarios y productos de prueba; ambiente DEV estable; tokens generados con JWT.
