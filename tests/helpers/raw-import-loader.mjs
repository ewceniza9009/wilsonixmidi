/**
 * Node module hooks for the unit suite.
 *
 * Vite resolves `import x from "./file.js?raw"` (source-as-string) and
 * `?url`, but plain `node --test` does not. This loader gives tests the same
 * semantics so modules that ship AudioWorklet source (pcm-processor,
 * shimmer-fx-processor, synth-processor, audio-tap-processor) are importable.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const RAW = "?raw";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith(RAW)) {
    const bare = specifier.slice(0, -RAW.length);
    const resolved = await nextResolve(bare, context);
    return { ...resolved, url: `${resolved.url}${RAW}`, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(RAW)) {
    const withoutQuery = new URL(url);
    withoutQuery.search = "";
    const source = await readFile(fileURLToPath(withoutQuery), "utf8");
    return {
      format: "module",
      source: `export default ${JSON.stringify(source)};`,
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
