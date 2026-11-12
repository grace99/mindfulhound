import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/AuthScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — mindfulhound" },
      { name: "description", content: "Sign in to your private mindfulhound expense ledger." },
      { property: "og:title", content: "Sign in — mindfulhound" },
      { property: "og:description", content: "Access your private expense ledger and spending insights." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthScreen,
});