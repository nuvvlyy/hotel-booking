import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");
  const guests = searchParams.get("guests");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};

  if (guests) {
    where.capacity = { gte: parseInt(guests) };
  }
  if (type && type !== "all") {
    where.type = type;
  }

  // Exclude rooms that have overlapping confirmed bookings
  if (checkIn && checkOut) {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    where.bookings = {
      none: {
        status: { not: "CANCELLED" },
        checkIn: { lt: checkOutDate },
        checkOut: { gt: checkInDate },
      },
    };
  }

  const rooms = await db.room.findMany({ where, orderBy: { pricePerNight: "asc" } });
  return NextResponse.json(rooms);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const room = await db.room.create({ data });
  return NextResponse.json(room, { status: 201 });
}
