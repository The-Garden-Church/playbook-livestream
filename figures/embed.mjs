import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pageHtml } from "./anatomy/kit/iso-kit.mjs";

const DOCS = join(dirname(fileURLToPath(import.meta.url)), "..", "docs");
const OUT = join(DOCS, "figures");
const DETENT = `<script>${readFileSync(join(DOCS, "javascripts", "detent.js"), "utf8").trim()}</script>`;

const EMBED_CSS = `<style>body{background:transparent}.iso-page{width:min(var(--figure-width),100% - 4px);margin:2px auto}</style>`;

const resizer = (name) =>
  `<script>new ResizeObserver(()=>parent.postMessage({figure:${JSON.stringify(name)},height:Math.ceil(document.documentElement.getBoundingClientRect().height)},"*")).observe(document.documentElement)</script>`;

export function writeFigure(name, { title, body, script, width = 650 }) {
  const page = pageHtml({ title, theme: "dark", body, script, width }).replace("</head>", `${EMBED_CSS.replace("var(--figure-width)", `${width}px`)}</head>`);
  const withDetent = page.replace('<script type="module">', () => `${DETENT}<script type="module">`);
  const end = withDetent.lastIndexOf("</body>");
  const html = withDetent.slice(0, end) + resizer(name) + withDetent.slice(end);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${name}.html`), html);
  console.log(`wrote docs/figures/${name}.html`);
}
