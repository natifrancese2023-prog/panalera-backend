# Codigo de barras por variante

## Cambio

La migracion agrega `codigo_barras` opcional a `producto_variantes`. Los productos
existentes conservan el valor nulo. Un indice unico parcial impide que dos variantes
usen el mismo codigo sin impedir variantes que todavia no tienen codigo.

El panel de Productos envia el valor dentro de cada variante. Los endpoints actuales
no cambian: el campo se incorpora de forma aditiva en las variantes devueltas por
`GET /productos` y `GET /productos/catalogo`.

## Despliegue y rollback

Ejecutar `20260730_producto_codigo_barras_up.sql` antes de desplegar el backend.
Para revertir solamente esta fase ejecutar el archivo `down.sql`; elimina el campo y
sus datos de codigos de barras, por lo que debe utilizarse solo si se acepta esa
perdida propia del rollback.

## Prueba manual

1. Crear una variante sin codigo: debe funcionar igual que antes.
2. Crear o editar una variante con un codigo: debe persistir y volver en el listado.
3. Intentar repetirlo en otra variante: debe responder 409.
