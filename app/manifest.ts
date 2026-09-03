import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flowin",
    short_name: "Flowin",
    description: "LinkedIn outreach operations for every brand from one place.",
    start_url: "/",
    display: "browser",
    background_color: "#200624",
    theme_color: "#200624",
    icons: [
      { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
