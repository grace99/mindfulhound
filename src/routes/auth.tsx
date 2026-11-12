import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/components/AuthScreen";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Account access — mindfulhound" },
      { name: "description", content: "Sign in or create your private mindfulhound account." },
      { property: "og:title", content: "Account access — mindfulhound" },
      { property: "og:description", content: "Sign in or create your private mindfulhound account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthScreen,
});