"use client";

import { markDownloadedAction } from "@/app/portal/actions";

export function EditableFileActions({ filename, resolutionId }: { filename: string; resolutionId?: string }) {
  function download() {
    const article = document.getElementById("documento-resolucion");
    const body = article?.innerHTML ?? "";
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(filename)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 46rem; margin: 2rem auto; padding: 0 1rem 3rem; line-height: 1.6; color: #1c1915; }
  h2 { margin-top: 2rem; }
  p { text-align: justify; }
  mark { background: #ffe566; color: inherit; padding: 0 0.08em; border-radius: 0.12em; }
  img { display: block; margin: 1rem auto; max-width: 100%; }
  summary { cursor: pointer; display: inline-block; border: 1px solid #1c1915; border-radius: 999px; padding: 0.55rem 0.9rem; }
  .solo-descarga { display: block; }
</style>
</head>
<body>
${body}
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    if (resolutionId) void markDownloadedAction(resolutionId);
  }

  return (
    <button type="button" className="btn btn-primario" onClick={download}>
      Descargar archivo editable
    </button>
  );
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
