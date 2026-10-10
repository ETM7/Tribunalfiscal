import type { Metadata } from "next";
import { LandingSheet } from "@/components/landing-sheet";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Tribunal Fiscal · Jurisprudencia con el criterio a la vista",
  description:
    "Busca resoluciones del Tribunal Fiscal y lee la sumilla junto al expediente. Herramienta independiente: no es un sitio del Estado.",
};

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="envoltura">
          <div>
            <span className="rotulo">Jurisprudencia tributaria</span>
            <h1>
              Encuentra el criterio del Tribunal Fiscal <em>dentro</em> de la resolución, no solo en la sumilla.
            </h1>
            <p className="bajada">
              Busca resoluciones desde 1964, lee la sumilla junto al expediente y salta a la página exacta donde
              aparece tu frase.
            </p>
            <form className="busca" role="search" action="/buscar" method="get">
              <label htmlFor="q" className="solo-lector">
                Tema o frase exacta
              </label>
              <input
                id="q"
                name="q"
                type="search"
                placeholder="contrato de estabilidad"
                autoComplete="off"
              />
              <button className="btn btn-primario" type="submit">
                Buscar gratis
              </button>
            </form>
            <p className="nota-busca">Sin registro. Las búsquedas son ilimitadas en todos los planes.</p>
          </div>
          <LandingSheet />
        </div>
      </section>

      <section className="bloque">
        <div className="envoltura">
          <div className="cab-sec">
            <span className="rotulo">Lo que cambia</span>
            <h2>La misma fuente oficial, sin perder la tarde buscando un párrafo.</h2>
          </div>
          <div className="compara">
            <div className="caso antes">
              <h3>Buscador del MEF</h3>
              <ul>
                <li>
                  <i>—</i>Cinco resultados por página y la sumilla en otra pantalla.
                </li>
                <li>
                  <i>—</i>Abres un PDF de 30 páginas para saber si te sirve.
                </li>
                <li>
                  <i>—</i>Control+F no encuentra nada en los PDF escaneados.
                </li>
                <li>
                  <i>—</i>Copiar un párrafo al escrito obliga a retipearlo.
                </li>
              </ul>
            </div>
            <div className="caso despues">
              <h3>Aquí</h3>
              <ul>
                <li>
                  <i>✓</i>La sumilla aparece junto a cada expediente.
                </li>
                <li>
                  <i>✓</i>Ves en qué páginas aparece tu frase antes de leer.
                </li>
                <li>
                  <i>✓</i>El texto completo se puede buscar con Control+F.
                </li>
                <li>
                  <i>✓</i>Corriges el texto y lo descargas editable.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="bloque">
        <div className="envoltura ficha-demo">
          <div className="ficha">
            <div className="ficha-top">
              <span className="exp">
                EXPEDIENTE: <b>2019_5_11125</b>
              </span>
              <span className="btn btn-secundario btn-chico">Ficha y PDF en el MEF</span>
            </div>
            <h4>Sumilla RTF:11125-5-2019</h4>
            <p className="sum">
              Se revoca la apelada. Las retribuciones por servicios de asistencia técnica prestados por una empresa
              domiciliada en un País Miembro solo son gravables donde se imputa y registra el gasto, conforme con la
              Decisión 578.
            </p>
            <div className="div" />
            <div className="prev">
              <p className="linea-hit">
                Tu frase <b>«decisión 578»</b> aparece en las páginas <b>1, 3 y 7</b>.
              </p>
              <p>
                Que, conforme con la Decisión 578 de la Comunidad Andina, las rentas obtenidas por empresas de
                servicios profesionales, técnicos o de consultoría solo serán gravables en el País Miembro en cuyo
                territorio se imputa y registra su correspondiente gasto, por lo que corresponde…
              </p>
              <div className="velo">
                <a className="btn btn-primario btn-chico" href="/precios">
                  Ir al criterio
                </a>
              </div>
            </div>
            <p className="pie">La cuenta Junior busca sin límite e incluye 3 lecturas del RTF editable al mes.</p>
          </div>
          <div>
            <span className="rotulo">Cada resultado</span>
            <h2 className="ficha-titulo">Antes de abrir, ya sabes si te sirve.</h2>
            <p className="ficha-bajada">
              La ficha muestra la sumilla oficial y dónde cae tu criterio. Si sirve, entras directo a esa página.
            </p>
            <div className="estados">
              <div className="estado">
                <h5>Sin cuenta</h5>
                <p>Buscas y lees sumillas sin límite.</p>
              </div>
              <div className="estado on">
                <h5>Junior, gratis</h5>
                <p>Búsquedas sin límite y 3 lecturas del RTF editable al mes.</p>
              </div>
              <div className="estado">
                <h5>Senior, Gerente o Estudio</h5>
                <p>Lees, buscas dentro y descargas editable según el cupo de tu plan.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bloque">
        <div className="envoltura">
          <div className="cab-sec">
            <span className="rotulo">Para quién</span>
            <h2>Hecho para quien cita resoluciones todos los días.</h2>
          </div>
          <div className="quienes">
            <div className="quien">
              <h3>Tributaristas</h3>
              <p>Sustentan apelaciones con el párrafo exacto y su página.</p>
            </div>
            <div className="quien">
              <h3>Asistentes de estudio</h3>
              <p>Filtran decenas de RTF en minutos, no en horas.</p>
            </div>
            <div className="quien">
              <h3>Contadores</h3>
              <p>Verifican el criterio antes de responder un requerimiento de SUNAT.</p>
            </div>
            <div className="quien">
              <h3>Áreas legales</h3>
              <p>Revisan el criterio y bajan el texto editable según el plan.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bloque">
        <div className="envoltura confianza">
          <p className="decl">
            La fuente es siempre el MEF. No guardamos copias de las resoluciones y el PDF oficial se abre en su sitio.
          </p>
          <div className="hechos">
            <div className="hecho">
              <span className="k">Fuente</span>
              <span>Buscador público del Tribunal Fiscal (MEF), consultado en vivo.</span>
            </div>
            <div className="hecho">
              <span className="k">Cobertura</span>
              <span>Sumillas desde 2000. Texto completo desde 1964.</span>
            </div>
            <div className="hecho">
              <span className="k">Aclaración</span>
              <span>Herramienta independiente. No es un sitio del Estado.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="bloque cta-bloque">
        <div className="envoltura">
          <div className="cta-final">
            <h2>Haz tu próxima búsqueda aquí y compara.</h2>
            <a className="btn" href="/buscar">
              Buscar gratis
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
