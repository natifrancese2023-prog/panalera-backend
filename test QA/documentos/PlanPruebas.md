Plan de Pruebas (IEEE 29119-3)

Introducción Propósito del plan: Validar la API de la pañalera mediante pruebas de caja negra, asegurando que login, pedidos y roles funcionen según requisitos.
Alcance: Puntos finales /auth/login, /pedidos, /pedidos/:id. Entornos: DEV (local con Postgres), QA (servidor de pruebas).

Referencias: Requisitos funcionales del sistema, diseño de base de datos, documentación de endpoints en Swagger/Postman.

Enfoque y Estrategia Niveles de prueba:
Unitarias (controladores con Jest).

Integración (API completa con Postman).

Sistema (flujo login → pedidos).

Aceptación (criterios del dueño de la pañalera).

Tipos de prueba: funcional, regresión, seguridad básica, rendimiento simple.

Criterios de entrada: build estable, endpoints accesibles, base de datos inicializada.

Criterios de salida: ≥95% casos OK, 0 defectos críticos abiertos.

Cobertura esperada: matriz requisito → caso de prueba (ejemplo: requisito “login con credenciales válidas” → caso TC-LOGIN-001).

Recursos y Roles Equipo: QA Tester (vos), Dev soporte (backend), PO (dueño del negocio).
Herramientas: Postman, Newman, Jest, GitHub para versionado.

Ambientes: DEV local, QA en servidor de pruebas.

Datos de prueba: usuarios ficticios, pedidos de prueba anonimizados.

Planificación Hitos:
Semana 1: pruebas de login.

Semana 2: pruebas de pedidos.

Semana 3: regresión y reporte final.

Riesgos y mitigación: base de datos inestable → usar scripts de reseteo.

Dependencias: disponibilidad del backend y base de datos.

Gestión de Defectos y Métricas Flujo de defectos: Nuevo → Asignado → En corrección → Verificado → Cerrado.
Gravedad/prioridad:

Crítico: login no funciona.

Alto: pedidos no se guardan.

Medio: mensajes de error poco claros.

Métricas: tasa de fallos por ejecución, densidad de defectos por módulo, % de casos ejecutados.

Aprobación Firmas/roles: QA Tester, Dev responsable, PO.
Fecha de aprobación: al cierre del ciclo de pruebas.
