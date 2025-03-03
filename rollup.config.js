import { defineConfig } from "rollup";
import typescript from "@rollup/plugin-typescript";

export default defineConfig({
  input: "src/index.ts",
  output: [
    {
      file: "dist/index.js",
      format: "esm",
      sourcemap: true
    },
    {
      file: "dist/index.cjs",
      format: "cjs",
      sourcemap: true
    }
  ],
  plugins: [typescript()]
});
