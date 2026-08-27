import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { AppShell } from "@/components/workspace/AppShell";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notification Center — Tarv MEP Calculator" },
      { name: "description", content: "View, manage, and track all coordination comments, tasks, and project notifications." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  return <AppShell />;
}
