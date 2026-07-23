import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ventilation")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
