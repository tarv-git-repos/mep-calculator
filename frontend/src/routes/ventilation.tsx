import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/ventilation")({
  head: () => ({
    meta: [
      { title: "Ventilation — MEP Calculator" },
      { name: "description", content: "Ventilation module: spaces, zones, equipment, and reports with live intelligence." },
    ],
  }),
  component: VentilationRedirect,
});

function VentilationRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/", replace: true });
  }, [navigate]);
  return null;
}
