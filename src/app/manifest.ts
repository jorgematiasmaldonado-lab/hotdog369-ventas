import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HOT DOG 369 · Ventas",
    short_name: "HD 369",
    description: "Control de ventas de la panchería HOT DOG 369",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#151A1D",
    theme_color: "#151A1D",
    lang: "es-AR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
