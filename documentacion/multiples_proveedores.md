# Multiples proveedores por producto

## Cambio

La migracion crea la tabla relacional `producto_proveedor`, sin alterar la tabla de
proveedores ni el catalogo existente. Un producto puede no tener proveedor o tener
varios; un proveedor puede estar asociado a varios productos.

El formulario de Productos reutiliza `GET /proveedores` y envia la lista dentro del
endpoint existente de alta o edicion. La propiedad `proveedores` se agrega a la
respuesta de `GET /productos`, sin cambiar campos existentes. Si un cliente legado no
envia `proveedores` en un PUT, sus asociaciones actuales se conservan.

## Despliegue y rollback

Ejecutar `20260730_producto_proveedor_up.sql` antes de desplegar el backend. El
archivo `down.sql` elimina exclusivamente la tabla relacional y sus asociaciones;
no modifica productos ni proveedores.

## Prueba manual

1. Crear o editar un producto y seleccionar dos proveedores.
2. Volver a abrirlo y verificar ambas selecciones.
3. Consultar `GET /productos` y verificar el arreglo `proveedores`.
4. Editar sin modificar proveedores desde un cliente legado y verificar que se
   mantienen las asociaciones existentes.
