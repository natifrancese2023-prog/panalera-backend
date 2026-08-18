# Requerimientos Funcionales — Backend Pañalera

> **Proyecto:** Sistema de gestión de pañalera (backend)
> **Fecha:** 14 de marzo de 2026
> **Versión:** 1.0

---

## Índice

1. [Requerimientos Funcionales Globales](#1-requerimientos-funcionales-globales)
2. [Requerimientos Funcionales Detallados](#2-requerimientos-funcionales-detallados)
   - [2.1 Autenticación](#21-autenticación)
   - [2.2 Usuarios](#22-usuarios)
   - [2.3 Productos](#23-productos)
   - [2.4 Pedidos](#24-pedidos)
3. [Diagrama de Clases (UML)](#3-diagrama-de-clases-uml)
4. [Diagrama de Casos de Uso (UML)](#4-diagrama-de-casos-de-uso-uml)

---

## 1. Requerimientos Funcionales Globales

El sistema debe proveer una API REST que permita la gestión integral de una pañalera, contemplando los siguientes módulos principales:

- **Autenticación:** El sistema debe permitir el inicio de sesión seguro mediante JWT, con validación de roles y control de expiración de tokens.
- **Usuarios:** El sistema debe permitir el registro, autenticación y gestión de usuarios con roles diferenciados (`cliente` y `dueño`).
- **Productos:** El sistema debe permitir la gestión completa del catálogo de productos, incluyendo operaciones CRUD y exposición de un catálogo público filtrado por disponibilidad de stock.
- **Pedidos:** El sistema debe permitir la creación y seguimiento de pedidos, aplicando validaciones de negocio sobre stock, cantidades y estados permitidos, con vistas diferenciadas según el rol del usuario.

---

## 2. Requerimientos Funcionales Detallados

### 2.1 Autenticación

- El sistema debe permitir el inicio de sesión mediante credenciales (email y contraseña).
- El sistema debe generar un token JWT firmado al autenticar exitosamente a un usuario.
- El sistema debe incluir en el payload del token el identificador del usuario y su rol.
- El sistema debe validar el token JWT en cada endpoint protegido antes de procesar la solicitud.
- El sistema debe rechazar solicitudes con tokens expirados, malformados o ausentes, retornando `401 Unauthorized`.
- El sistema debe restringir el acceso a recursos según el rol declarado en el token (`cliente` o `dueño`), retornando `403 Forbidden` ante accesos no autorizados.

---

### 2.2 Usuarios

- El sistema debe permitir el registro de nuevos usuarios con los campos: nombre, email, contraseña y rol.
- El sistema debe encriptar la contraseña antes de almacenarla en la base de datos.
- El sistema debe impedir el registro de dos usuarios con el mismo email, retornando un error descriptivo.
- El sistema debe asignar por defecto el rol `cliente` si no se especifica uno durante el registro.
- El sistema debe permitir el inicio de sesión de usuarios registrados, validando email y contraseña.
- El sistema debe diferenciar el comportamiento de la API según el rol del usuario autenticado:
  - **Cliente:** acceso a catálogo, creación y consulta de sus propios pedidos.
  - **Dueño:** acceso completo a productos, todos los pedidos y cambio de estados.

---

### 2.3 Productos

- El sistema debe permitir al **dueño** crear nuevos productos con los campos: nombre, descripción, stock, precio de compra, precio de venta y categoría.
- El sistema debe permitir al **dueño** editar cualquier atributo de un producto existente.
- El sistema debe permitir al **dueño** eliminar un producto del sistema.
- El sistema debe permitir al **dueño** consultar el listado completo de productos, incluyendo aquellos sin stock.
- El sistema debe exponer un endpoint público (`GET /productos/catalogo`) que retorne únicamente los productos con `stock > 0`, incluyendo el campo `precio_venta`.
- El sistema debe retornar `404 Not Found` al intentar operar sobre un producto inexistente.

---

### 2.4 Pedidos

**Creación de pedidos:**

- El sistema debe permitir al **cliente** autenticado crear un pedido con uno o más productos, indicando la cantidad por ítem.
- El sistema debe permitir al **dueño** crear un pedido en nombre de un cliente, siendo obligatorio especificar el campo `id_cliente`.
- El sistema debe rechazar la creación de un pedido si el **dueño** no incluye `id_cliente`, retornando `400 Bad Request` con el mensaje `"Debe especificar id_cliente"`.
- El sistema debe rechazar pedidos con `cantidad <= 0`, retornando `400 Bad Request` con el mensaje `"La cantidad debe ser mayor a 0"`.
- El sistema debe verificar el stock disponible de cada producto antes de confirmar un pedido. Si la cantidad solicitada supera el stock, debe retornar `400 Bad Request` con el mensaje `"Stock insuficiente"`.
- El sistema debe registrar el pedido con estado inicial `pendiente` y la fecha de creación.

**Consulta de pedidos:**

- El sistema debe permitir al **cliente** listar únicamente sus propios pedidos.
- El sistema debe permitir al **dueño** listar todos los pedidos registrados en el sistema.
- El sistema debe retornar `404 Not Found` al intentar acceder a un pedido inexistente.

**Cambio de estado:**

- El sistema debe permitir al **dueño** cambiar el estado de un pedido.
- El sistema debe restringir los valores de estado permitidos a: `pendiente`, `confirmado`, `entregado` y `cancelado`.
- El sistema debe rechazar cualquier valor de estado fuera del conjunto permitido, retornando `400 Bad Request` con el mensaje `"Estado inválido"`.

---

## 3. Diagrama de Clases (UML)

```mermaid
classDiagram
    direction LR

    class Usuario {
        +int id
        +string nombre
        +string email
        +string contraseña
        +string rol
        +registrarse()
        +iniciarSesion()
    }

    class Producto {
        +int id
        +string nombre
        +string descripcion
        +int stock
        +float precio_compra
        +float precio_venta
        +int id_categoria
        +crear()
        +editar()
        +eliminar()
        +listar()
    }

    class Pedido {
        +int id
        +date fecha
        +string estado
        +int id_cliente
        +crear()
        +listar()
        +cambiarEstado()
    }

    class DetallePedido {
        +int id_pedido
        +int id_producto
        +int cantidad
        +float precio_unitario
    }

    class Categoria {
        +int id
        +string nombre
    }

    Usuario "1" --> "0..*" Pedido : realiza
    Pedido "1" --> "1..*" DetallePedido : contiene
    DetallePedido "1..*" --> "1" Producto : referencia
    Producto "1..*" --> "1" Categoria : pertenece a
```

---

## 4. Diagrama de Casos de Uso (UML)

```mermaid
flowchart TD
    subgraph Actores
        CLI(["👤 Cliente"])
        DUE(["👔 Dueño"])
        SIS(["⚙️ Sistema"])
    end

    subgraph UC_Auth ["Autenticación"]
        UC1["Registrarse"]
        UC2["Iniciar sesión"]
        UC3["Validar credenciales"]
        UC4["Generar token JWT"]
        UC5["Verificar token y rol"]
    end

    subgraph UC_Cat ["Catálogo"]
        UC6["Ver catálogo público"]
    end

    subgraph UC_Prod ["Gestión de Productos"]
        UC7["Crear producto"]
        UC8["Editar producto"]
        UC9["Eliminar producto"]
        UC10["Listar todos los productos"]
    end

    subgraph UC_Ped ["Gestión de Pedidos"]
        UC11["Crear pedido propio"]
        UC12["Crear pedido por cliente"]
        UC13["Listar pedidos propios"]
        UC14["Listar todos los pedidos"]
        UC15["Cambiar estado de pedido"]
    end

    subgraph UC_Val ["Validaciones del Sistema"]
        UC16["Verificar stock disponible"]
        UC17["Validar cantidad > 0"]
        UC18["Validar id_cliente obligatorio"]
        UC19["Validar estados permitidos"]
    end

    %% Cliente
    CLI --> UC1
    CLI --> UC2
    CLI --> UC6
    CLI --> UC11
    CLI --> UC13

    %% Dueño
    DUE --> UC2
    DUE --> UC7
    DUE --> UC8
    DUE --> UC9
    DUE --> UC10
    DUE --> UC12
    DUE --> UC14
    DUE --> UC15

    %% Sistema — Autenticación
    UC2 --> UC3
    UC3 --> UC4
    UC4 --> UC5

    %% Sistema — Validaciones en pedidos
    UC11 --> UC16
    UC11 --> UC17
    UC12 --> UC16
    UC12 --> UC17
    UC12 --> UC18
    UC15 --> UC19

    %% Estilos
    style CLI fill:#dbeafe,stroke:#3b82f6,color:#1e3a5f
    style DUE fill:#dcfce7,stroke:#22c55e,color:#14532d
    style SIS fill:#fef9c3,stroke:#eab308,color:#713f12
    style UC_Auth fill:#f1f5f9,stroke:#94a3b8
    style UC_Cat fill:#f1f5f9,stroke:#94a3b8
    style UC_Prod fill:#f1f5f9,stroke:#94a3b8
    style UC_Ped fill:#f1f5f9,stroke:#94a3b8
    style UC_Val fill:#fef3c7,stroke:#f59e0b
```

---

*Documentación de requerimientos funcionales — Backend Pañalera — v1.0*
