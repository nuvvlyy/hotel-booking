import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const bookings = await db.booking.findMany({
    where: { userId: session.user.id },
    include: { room: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(bookings);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId, checkIn, checkOut, guests } = await req.json();
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  // Verify no overlapping booking exists
  const conflict = await db.booking.findFirst({
    where: {
      roomId,
      status: { not: "CANCELLED" },
      checkIn: { lt: checkOutDate },
      checkOut: { gt: checkInDate },
    },
  });
  if (conflict) {
    return NextResponse.json({ error: "Room is not available for the selected dates" }, { status: 409 });
  }

  const room = await db.room.findUnique({ where: { id: roomId } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const nights = Math.ceil(
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const totalPrice = nights * room.pricePerNight;

  const booking = await db.booking.create({
    data: {
      userId: session.user.id,
      roomId,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      guests: parseInt(guests),
      totalPrice,
      status: "CONFIRMED",
    },
    include: { room: true },
  });

  return NextResponse.json(booking, { status: 201 });
}
