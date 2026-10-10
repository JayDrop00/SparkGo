import Badge, { type BadgeTone } from "@/components/ui/Badge";
import type { Difficulty } from "../schemas/task.schema";

const TONES: Record<Difficulty, BadgeTone> = {
  EASY: "success",
  MEDIUM: "info",
  HARD: "warning",
  VERY_HARD: "danger",
};

const LABELS: Record<Difficulty, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
  VERY_HARD: "Very hard",
};

export function difficultyLabel(difficulty: Difficulty): string {
  return LABELS[difficulty];
}

export default function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <Badge tone={TONES[difficulty]}>{LABELS[difficulty]}</Badge>;
}
