# Historial de costos de Productos

## Cambio

La migracion `migrations/20260730_producto_historial_costo_up.sql` agrega la tabla
`producto_historial_costo`, sin alterar tablas existentes.

Se registra el costo inicial de cada variante y todo cambio efectivo de
`precio_compra` efectuado desde Productos o al registrar una Compra. Cada registro
incluye producto, variante cuando corresponde, costo anterior, costo nuevo, fecha y
usuario. La escritura comparte la transaccion del proceso original.

## Despliegue y rollback

1. Confirmar las claves `producto(id_producto)`, `producto_variantes(id_variante)`
   y `usuario(id_usuario)` en la base objetivo.
2. Ejecutar `20260730_producto_historial_costo_up.sql`.
3. Para revertir solamente esta fase, ejecutar
   `20260730_producto_historial_costo_down.sql`.

El rollback elimina el historial de costos, pero no modifica costos, stock, compras
ni productos existentes.

## Prueba manual

1. Crear una variante: debe registrarse un costo inicial con costo anterior nulo.
2. Editar solo el costo: debe registrarse una fila con ambos importes.
3. Registrar una compra para una variante con costo diferente: debe quedar una fila
   adicional asociada al usuario autenticado.
4. Editar stock o precio de venta sin cambiar costo: no debe insertarse historial.
