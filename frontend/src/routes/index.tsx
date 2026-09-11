import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "./dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — MEP Calculator" },
      { name: "description", content: "MEP project analytics, compliance, alerts, and quick calculation access." },
    ],
  }),
  component: DashboardPage,
});
