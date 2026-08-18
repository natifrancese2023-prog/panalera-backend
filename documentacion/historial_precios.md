# Historial de precios de Productos

## Cambio

La migracion `migrations/20260730_producto_historial_precio_up.sql` agrega la tabla
`producto_historial_precio`. No modifica tablas ni columnas existentes.

Cada alta de variante registra su precio inicial con `precio_anterior` nulo. Cada
edicion registra una fila solamente cuando cambia `precio_venta`. La operacion se
ejecuta en la misma transaccion que el alta o la edicion del producto.

## Despliegue y rollback

1. Confirmar en la base objetivo que existen `producto_variantes(id_variante)` y
   `usuario(id_usuario)` con tipos compatibles.
2. Ejecutar el archivo `20260730_producto_historial_precio_up.sql` con una cuenta
   con permiso para crear tablas e indices.
3. Para revertir exclusivamente esta funcionalidad, ejecutar
   `20260730_producto_historial_precio_down.sql`. El rollback elimina solo el
   historial creado por esta migracion; no modifica precios ni variantes.

## Prueba manual

1. Crear un producto con una variante y verificar una fila con precio anterior
   nulo y el usuario autenticado.
2. Editar la variante cambiando el precio de venta y verificar una segunda fila
   con el valor anterior y el nuevo.
3. Editar solo nombre, stock o costo y verificar que no se agregue una fila.
4. Forzar un error de insercion del historial en un entorno de prueba y verificar
   que tampoco se persista el cambio de precio.

## Riesgo e impacto

El riesgo principal es ejecutar la migracion sobre un esquema distinto al inferido
por el codigo. La funcionalidad no cambia endpoints ni respuestas JSON y no es
consumida por los frontends actuales.
