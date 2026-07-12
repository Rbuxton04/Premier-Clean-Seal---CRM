import type { MetadataRoute } from "next";

// No manifest existed before this fix, which is *why* the installed PWA icon
// was opening on /map: without a manifest, "Add to Home Screen" just
// bookmarks whatever page happens to be open at the time, not a fixed
// start_url. This file gives the app a real start_url so every future
// install (or re-add) always lands on the Dashboard.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Premier Clean & Seal - CRM",
    short_name: "PC&S CRM",
    description: "Customer lifecycle CRM for Premier Clean & Seal.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3C2263",
    icons: [
      {
        src: "/logo.png",
        sizes: "500x500",
        type: "image/png",
      },
    ],
  };
}
