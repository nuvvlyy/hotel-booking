const MAX_COMMENT_LENGTH = 1000;

export function isReviewEligible(booking: { status: string; checkOut: Date }): boolean {
  return booking.status === "CONFIRMED" && booking.checkOut < new Date();
}

export function validateReviewInput(input: {
  rating: unknown;
  comment?: unknown;
}):
  | { ok: true; rating: number; comment: string | null }
  | { ok: false; error: string } {
  const { rating, comment } = input;

  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Rating must be a whole number from 1 to 5" };
  }

  if (comment === undefined || comment === null || comment === "") {
    return { ok: true, rating, comment: null };
  }

  if (typeof comment !== "string") {
    return { ok: false, error: "Comment must be text" };
  }
  if (comment.length > MAX_COMMENT_LENGTH) {
    return { ok: false, error: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer` };
  }

  return { ok: true, rating, comment };
}
