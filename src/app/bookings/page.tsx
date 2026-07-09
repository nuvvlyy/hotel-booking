"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Room = { id: string; name: string; type: string };
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
};

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    CONFIRMED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
    PENDING: "bg-yellow-100 text-yellow-700",
  };
  return `text-xs font-semibold px-2 py-0.5 rounded-full ${colors[status] ?? "bg-gray-100 text-gray-600"}`;
}

function isPast(checkOut: string) {
  return new Date(checkOut) < new Date();
}

export default function BookingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data) => {
        setBookings(data);
        setLoading(false);
      });
  }, [status]);

  if (loading || status === "loading") {
    return <div className="text-center py-20 text-gray-400">Loading…</div>;
  }

  const upcoming = bookings.filter((b) => !isPast(b.checkOut) && b.status !== "CANCELLED");
  const past = bookings.filter((b) => isPast(b.checkOut) || b.status === "CANCELLED");

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">My Bookings</h1>

      {bookings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="mb-4">You have no bookings yet.</p>
          <Link href="/" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition">
            Browse Rooms
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-3">Upcoming</h2>
              <div className="space-y-4">
                {upcoming.map((b) => (
                  <BookingCard key={b.id} booking={b} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-700 mb-3">Past / Cancelled</h2>
              <div className="space-y-4">
                {past.map((b) => (
                  <BookingCard key={b.id} booking={b} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  const checkInDate = new Date(booking.checkIn).toLocaleDateString();
  const checkOutDate = new Date(booking.checkOut).toLocaleDateString();

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-gray-800 truncate">{booking.room.name}</span>
          <span className={statusBadge(booking.status)}>{booking.status}</span>
        </div>
        <p className="text-sm text-gray-500 mb-1">
          {checkInDate} → {checkOutDate} · {booking.guests} guest(s)
        </p>
        <p className="text-xs text-gray-400 font-mono">Ref: {booking.referenceNumber}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-gray-800 mb-1">${booking.totalPrice.toFixed(2)}</p>
        <Link
          href={`/bookings/${booking.id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          Manage
        </Link>
      </div>
    </div>
  );
}
