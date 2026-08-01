// FilesetResolver.forVisionTasks() fetches the WASM fileset from a directory
// URL at runtime — nothing statically imports it, so Vite never sees it.
// Copy it into public/ so it's served verbatim at the app's base path.
import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = path.join(root, "public", "mediapipe", "wasm");

await mkdir(path.dirname(dest), { recursive: true });
await cp(src, dest, { recursive: true });
console.log(`Copied MediaPipe wasm fileset to ${path.relative(root, dest)}`);
