"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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

const ROOM_TYPES = ["all", "single", "double", "suite", "deluxe"];

export default function HomePage() {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [guests, setGuests] = useState("1");
  const [type, setType] = useState("all");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searched, setSearched] = useState(false);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ checkIn, checkOut, guests, type });
    const res = await fetch(`/api/rooms?${params}`);
    const data = await res.json();
    setRooms(data);
    setLoading(false);
    setSearched(true);
  }, [checkIn, checkOut, guests, type]);

  useEffect(() => {
    fetchRooms();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Find Your Perfect Room</h1>
        <p className="text-gray-500">Search available rooms and book instantly</p>
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Check-in</label>
            <input
              type="date"
              value={checkIn}
              min={today}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Check-out</label>
            <input
              type="date"
              value={checkOut}
              min={checkIn}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Guests</label>
            <input
              type="number"
              min="1"
              max="10"
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Room Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ROOM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchRooms}
            className="bg-blue-600 text-white rounded-lg px-6 py-2 font-semibold hover:bg-blue-700 transition"
          >
            Search
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading rooms…</div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {searched ? "No rooms available for the selected criteria." : "Search for available rooms above."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <div key={room.id} className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition">
              <div className="h-48 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                {room.imageUrl ? (
                  <img src={room.imageUrl} alt={room.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl">🏨</span>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-1">
                  <h2 className="text-lg font-bold text-gray-800">{room.name}</h2>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium capitalize">
                    {room.type}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{room.description}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <span>Up to {room.capacity} guests</span>
                </div>
                {room.amenities && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {room.amenities.split(",").map((a) => (
                      <span key={a} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {a.trim()}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xl font-bold text-gray-800">
                      ${room.pricePerNight.toFixed(0)}
                    </span>
                    <span className="text-sm text-gray-500"> / night</span>
                  </div>
                  <Link
                    href={`/rooms/${room.id}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
                  >
                    View &amp; Book
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
