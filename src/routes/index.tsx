import { createFileRoute } from "@tanstack/react-router";
import { DeckApp } from "@/components/deck-app";

export const Route = createFileRoute("/")({ component: DeckApp });
