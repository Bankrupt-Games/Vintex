import type { Metadata } from "next";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard — Vintex",
  description: "Manage Vintex studios, usage credits, members, and game-server access.",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
