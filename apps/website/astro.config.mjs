/* eslint-disable import/no-default-export */
/* eslint-disable import/no-unresolved */
import solid from "@astrojs/solid-js";
import tailwindIntegration from "@astrojs/tailwind";
import { defineConfig } from "astro/config";
import { resolve } from "path";
import Icons from "unplugin-icons/vite";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [
      Icons({
        compiler: "solid",
      }),
    ],
    // envDir: resolve(__dirname, "../../"),
    ssr: {
      noExternal: "style.css", // from @gd/ui
    },
  },
  integrations: [solid(), tailwindIntegration()],
});
