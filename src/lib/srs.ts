// SM-2 spaced repetition algorithm.
// Based on: https://www.supermemo.com/en/blog/20-years-of-computational-research
import type { ReviewResult, WordStatus } from "@/lib/enums";

type Grade = 0 | 1 | 2 | 3 | 4 | 5;

const resultToGrade: Record<ReviewResult, Grade> = {
  AGAIN: 0,
  HARD: 2,
  GOOD: 3,
  EASY: 5,
};

export interface SrsInput {
  result: ReviewResult;
  repetitions: number;
  easeFactor: number; // SM-2 quality factor q
  intervalDays: number;
}

export interface SrsOutput {
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
  nextReviewAt: Date;
  status: WordStatus;
}

const dayMs = 24 * 60 * 60 * 1000;

function clampEase(q: number): number {
  return Math.max(1.3, q);
}

export function scheduleReview(input: SrsInput): SrsOutput {
  const grade = resultToGrade[input.result];
  let { repetitions, easeFactor, intervalDays } = input;

  easeFactor = clampEase(easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));

  if (grade < 3) {
    // Forgot / too hard: reset the learning sequence.
    repetitions = 0;
    intervalDays = 0; // due again (re-queue) shortly
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor);
  }

  // "again" -> review again within the same session (10 min), else schedule by days.
  const delayMs = grade < 3 ? 10 * 60 * 1000 : intervalDays * dayMs;
  const nextReviewAt = new Date(Date.now() + delayMs);

  const status: WordStatus =
    repetitions === 0
      ? "LEARNING"
      : intervalDays >= 21
        ? "MASTERED"
        : "REVIEWING";

  return { repetitions, easeFactor, intervalDays, nextReviewAt, status };
}
