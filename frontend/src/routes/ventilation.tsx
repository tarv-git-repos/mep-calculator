import { createFileRoute } from "@tanstack/react-router";
import { VentilationModule } from "./index";

export const Route = createFileRoute("/ventilation")({
  head: () => ({
    meta: [
      { title: "Ventilation — MEP Calculator" },
      { name: "description", content: "Ventilation module: spaces, zones, equipment, and reports with live intelligence." },
    ],
  }),
  component: VentilationModule,
});
