# Tribunalfiscal

Filtro de resoluciones del Tribunal Fiscal. Busca en el formulario público del MEF y muestra la sumilla en la misma lista. No es el sitio oficial. No guarda una copia de las resoluciones.

## Cómo levantarla

Desde la raíz de este repositorio:

```bash
npm install
npm run dev
```

Queda en [http://127.0.0.1:43128](http://127.0.0.1:43128).

Cada búsqueda lee una página del buscador oficial y, en serie, la sumilla de esos resultados. La página siguiente solo se pide con el botón Siguiente. Si el total pasa de 50, hay que afinar el criterio antes de seguir.

## Cuentas y planes

Las búsquedas están abiertas en todos los planes. El botón Abrir RTF editable depende del plan:

- Junior, gratis: búsquedas, sin RTF editable.
- Senior, S/ 49 al mes: 20 consultas al RTF editable por mes.
- Gerente, S/ 99 al mes: 100 consultas al mes.
- Socio, S/ 300 al mes: consultas sin límite.

El portal está en `/portal` y el panel de administrador en `/admin`. El primer arranque crea `admin@tribunalfiscal.pe` y escribe la contraseña en `data/admin-inicial.txt`. Esa carpeta no se sube a git. Aquí no se cobra la tarjeta: la persona solicita el plan y el administrador lo activa al confirmar el pago.

Cada resolución distinta cuenta una vez por mes calendario de Lima. Volver a abrirla no gasta otra consulta.
