// Shared string-literal union types.
// SQLite has no native enum support, so the Prisma schema stores these as
// STRING columns and we model the allowed values here. Keep in sync with the
// defaults used in prisma/schema.prisma.

export type ExamType =
  | "COMMON"
  | "CET4"
  | "CET6"
  | "KY"
  | "TEM4"
  | "TEM8"
  | "IELTS"
  | "TOEFL";

export type WordStatus = "NEW" | "LEARNING" | "REVIEWING" | "MASTERED";

export type ReviewResult = "AGAIN" | "HARD" | "GOOD" | "EASY";
