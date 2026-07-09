"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams, useParams } from "next/navigation";

type Room = {
  id: string;
  name: string;
  type: string;
  description: string;
  pricePerNight: number;
  capacity: number;
  imageUrl: string | null;
  amenities: string;
};

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const [room, setRoom] = useState<Room | null>(null);
  const [checkIn, setCheckIn] = useState(searchParams.get("checkIn") || today);
  const [checkOut, setCheckOut] = useState(searchParams.get("checkOut") || tomorrow);
  const [guests, setGuests] = useState(searchParams.get("guests") || "1");
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ referenceNumber: string } | null>(null);

  useEffect(() => {
    fetch(`/api/rooms/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setRoom(data);
        setLoading(false);
      });
  }, [id]);

  const nights = Math.max(
    1,
    Math.ceil(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  async function handleBook() {
    if (!session) {
      router.push(`/login?returnTo=/rooms/${id}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`);
      return;
    }
    setError("");
    setBooking(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: id, checkIn, checkOut, guests }),
    });
    const data = await res.json();
    setBooking(false);
    if (!res.ok) {
      setError(data.error || "Booking failed");
    } else {
      setSuccess({ referenceNumber: data.referenceNumber });
    }
  }

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  if (!room) return <div className="text-center py-20 text-gray-400">Room not found.</div>;

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-2xl shadow-md p-10">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Booking Confirmed!</h2>
          <p className="text-gray-500 mb-6">Your reservation reference number is:</p>
          <p className="text-xl font-mono font-bold text-blue-600 bg-blue-50 px-6 py-3 rounded-lg mb-6">
            {success.referenceNumber}
          </p>
          <p className="text-sm text-gray-400 mb-6">
            {checkIn} → {checkOut} · {guests} guest(s)
          </p>
          <button
            onClick={() => router.push("/bookings")}
            className="w-full bg-blue-600 text-white rounded-lg py-2 font-semibold hover:bg-blue-700 transition"
          >
            View My Bookings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline mb-4 block">
        ← Back to results
      </button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Room info */}
        <div className="lg:col-span-2">
          <div className="h-64 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center mb-6 overflow-hidden">
            {room.imageUrl ? (
              <img src={room.imageUrl} alt={room.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-7xl">🏨</span>
            )}
          </div>
          <div className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-800">{room.name}</h1>
              <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium capitalize">
                {room.type}
              </span>
            </div>
            <p className="text-gray-600 mb-4">{room.description}</p>
            <div className="flex items-center gap-6 text-sm text-gray-500 mb-4">
              <span>👥 Up to {room.capacity} guests</span>
              <span>💰 ${room.pricePerNight.toFixed(0)} / night</span>
            </div>
            {room.amenities && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Amenities</p>
                <div className="flex flex-wrap gap-2">
                  {room.amenities.split(",").map((a) => (
                    <span key={a} className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                      {a.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Booking panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-md p-6 sticky top-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Book this room</h2>
            {error && (
              <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                {error}
              </p>
            )}
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Check-in</label>
                <input
                  type="date"
                  value={checkIn}
                  min={today}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Check-out</label>
                <input
                  type="date"
                  value={checkOut}
                  min={checkIn}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Guests</label>
                <input
                  type="number"
                  min="1"
                  max={room.capacity}
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4 mb-4">
              <div className="flex justify-between text-sm text-gray-500 mb-1">
                <span>${room.pricePerNight.toFixed(0)} × {nights} night{nights !== 1 ? "s" : ""}</span>
                <span>${(room.pricePerNight * nights).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-800">
                <span>Total</span>
                <span>${(room.pricePerNight * nights).toFixed(2)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Payment processed at check-in</p>
            </div>
            <button
              onClick={handleBook}
              disabled={booking}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-semibold hover:bg-blue-700 disabled:opacity-60 transition"
            >
              {booking ? "Booking…" : session ? "Book Now" : "Sign in to Book"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
