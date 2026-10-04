import { register } from "node:module";

register("./raw-import-loader.mjs", import.meta.url);
