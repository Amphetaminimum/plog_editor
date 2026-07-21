import { cp, mkdir, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = resolve(projectRoot, "public");

await rm(publicRoot, { recursive: true, force: true });
await mkdir(publicRoot, { recursive: true });

for (const file of ["index.html", "editor.html", "app.js", "styles.css", "favicon.svg"]) {
  await cp(resolve(projectRoot, file), resolve(publicRoot, file));
}

for (const directory of ["assets", "js"]) {
  await cp(resolve(projectRoot, directory), resolve(publicRoot, directory), {
    recursive: true,
    filter: (source) => !/^DSC.*\.jpe?g$/i.test(basename(source)),
  });
}
