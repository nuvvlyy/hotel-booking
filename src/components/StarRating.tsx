"use client";

type StarRatingProps = {
  mode: "input";
  value: number;
  onChange: (rating: number) => void;
  size?: "sm" | "md";
};

export function StarRating({ value, onChange, size = "md" }: StarRatingProps) {
  const sizeClass = size === "sm" ? "text-base" : "text-2xl";

  return (
    <div className={`flex gap-1 ${sizeClass}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
          className={star <= value ? "text-yellow-400" : "text-gray-300 hover:text-yellow-300"}
        >
          ★
        </button>
      ))}
    </div>
  );
}
