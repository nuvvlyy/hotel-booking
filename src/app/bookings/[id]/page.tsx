"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { StarRating } from "@/components/StarRating";

type Room = { id: string; name: string; type: string; pricePerNight: number };
type Review = { id: string; rating: number; comment: string | null; createdAt: string };
type Booking = {
  id: string;
  referenceNumber: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalPrice: number;
  status: string;
  createdAt: string;
  room: Room;
  review: Review | null;
  canReview: boolean;
};

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    CONFIRMED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
    PENDING: "bg-yellow-100 text-yellow-700",
  };
  return `text-sm font-semibold px-3 py-1 rounded-full ${colors[status] ?? "bg-gray-100 text-gray-600"}`;
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { status } = useSession();
  const router = useRouter();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Modify state
  const [modifying, setModifying] = useState(false);
  const [newCheckIn, setNewCheckIn] = useState("");
  const [newCheckOut, setNewCheckOut] = useState("");

  // Review state
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`/api/bookings/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        setBooking(data);
        setNewCheckIn(data.checkIn.slice(0, 10));
        setNewCheckOut(data.checkOut.slice(0, 10));
        setLoading(false);
      })
      .catch(() => {
        setError("Booking not found");
        setLoading(false);
      });
  }, [id, status]);

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    setActionLoading(true);
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    const data = await res.json();
    setActionLoading(false);
    if (res.ok) setBooking(data);
    else setError(data.error || "Failed to cancel");
  }

  async function handleModify() {
    setError("");
    setActionLoading(true);
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkIn: newCheckIn, checkOut: newCheckOut }),
    });
    const data = await res.json();
    setActionLoading(false);
    if (res.ok) {
      setBooking(data);
      setModifying(false);
    } else {
      setError(data.error || "Failed to modify booking");
    }
  }

  async function handleSubmitReview() {
    setReviewError("");
    if (reviewRating < 1) {
      setReviewError("Please select a star rating");
      return;
    }
    setReviewSubmitting(true);
    const res = await fetch(`/api/bookings/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: reviewRating, comment: reviewComment || undefined }),
    });
    const data = await res.json();
    setReviewSubmitting(false);
    if (res.ok) {
      setBooking((prev) => (prev ? { ...prev, review: data, canReview: false } : prev));
    } else {
      setReviewError(data.error || "Failed to submit review");
    }
  }

  if (loading || status === "loading") {
    return <div className="text-center py-20 text-gray-400">Loading…</div>;
  }
  if (error && !booking) {
    return <div className="text-center py-20 text-gray-400">{error}</div>;
  }
  if (!booking) return null;

  const checkInDate = new Date(booking.checkIn).toLocaleDateString();
  const checkOutDate = new Date(booking.checkOut).toLocaleDateString();
  const isFuture = new Date(booking.checkIn) > new Date();
  const isActive = booking.status === "CONFIRMED" && isFuture;
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => router.push("/bookings")} className="text-sm text-blue-600 hover:underline mb-4 block">
        ← Back to my bookings
      </button>

      <div className="bg-white rounded-2xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">{booking.room.name}</h1>
          <span className={statusBadge(booking.status)}>{booking.status}</span>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div className="border border-gray-100 rounded-xl p-4 mb-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Reference</span>
            <span className="font-mono font-semibold text-blue-600">{booking.referenceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Check-in</span>
            <span className="font-medium text-gray-700">{checkInDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Check-out</span>
            <span className="font-medium text-gray-700">{checkOutDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Guests</span>
            <span className="font-medium text-gray-700">{booking.guests}</span>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-2">
            <span className="text-gray-500">Total</span>
            <span className="font-bold text-gray-800">${booking.totalPrice.toFixed(2)}</span>
          </div>
        </div>

        {isActive && (
          <div className="space-y-3">
            {!modifying ? (
              <div className="flex gap-3">
                <button
                  onClick={() => setModifying(true)}
                  className="flex-1 border border-blue-600 text-blue-600 rounded-lg py-2 font-semibold hover:bg-blue-50 transition"
                >
                  Modify Dates
                </button>
                <button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="flex-1 border border-red-400 text-red-500 rounded-lg py-2 font-semibold hover:bg-red-50 disabled:opacity-60 transition"
                >
                  {actionLoading ? "Cancelling…" : "Cancel Booking"}
                </button>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">Change dates</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">New check-in</label>
                    <input
                      type="date"
                      value={newCheckIn}
                      min={today}
                      onChange={(e) => setNewCheckIn(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">New check-out</label>
                    <input
                      type="date"
                      value={newCheckOut}
                      min={newCheckIn}
                      onChange={(e) => setNewCheckOut(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleModify}
                    disabled={actionLoading}
                    className="flex-1 bg-blue-600 text-white rounded-lg py-2 font-semibold hover:bg-blue-700 disabled:opacity-60 transition text-sm"
                  >
                    {actionLoading ? "Saving…" : "Confirm Changes"}
                  </button>
                  <button
                    onClick={() => { setModifying(false); setError(""); }}
                    className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 font-semibold hover:bg-gray-50 transition text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {booking.review ? (
          <div className="border-t border-gray-100 mt-4 pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">Your review</p>
            <div className="flex gap-1 text-lg mb-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className={star <= booking.review!.rating ? "text-yellow-400" : "text-gray-300"}>
                  ★
                </span>
              ))}
            </div>
            {booking.review.comment && (
              <p className="text-sm text-gray-600">{booking.review.comment}</p>
            )}
          </div>
        ) : booking.canReview ? (
          <div className="border-t border-gray-100 mt-4 pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">Leave a review</p>
            {reviewError && (
              <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                {reviewError}
              </p>
            )}
            <StarRating mode="input" value={reviewRating} onChange={setReviewRating} />
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Share your experience (optional)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSubmitReview}
              disabled={reviewSubmitting}
              className="mt-3 bg-blue-600 text-white rounded-lg py-2 px-4 font-semibold hover:bg-blue-700 disabled:opacity-60 transition text-sm"
            >
              {reviewSubmitting ? "Submitting…" : "Submit Review"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
