# Tribunalfiscal

Filtro de resoluciones del Tribunal Fiscal. Busca en el formulario público del MEF y muestra la sumilla en la misma lista. No es el sitio oficial. No guarda cuentas ni una copia de las resoluciones.

## Cómo levantarla

Desde la raíz de este repositorio:

```bash
npm install
npm run dev
```

Queda en [http://127.0.0.1:43128](http://127.0.0.1:43128).

Cada búsqueda lee una página del buscador oficial y, en serie, la sumilla de esos resultados. La página siguiente solo se pide con el botón Siguiente. Si el total pasa de 50, hay que afinar el criterio antes de seguir.
