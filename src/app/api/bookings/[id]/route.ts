import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isReviewEligible } from "@/lib/reviews";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const booking = await db.booking.findUnique({ where: { id }, include: { room: true, review: true } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    ...booking,
    canReview: isReviewEligible(booking) && !booking.review,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const booking = await db.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { checkIn, checkOut, status } = await req.json();

  // Cancellation
  if (status === "CANCELLED") {
    const updated = await db.booking.update({ where: { id }, data: { status: "CANCELLED" } });
    return NextResponse.json(updated);
  }

  // Date modification
  if (checkIn && checkOut) {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    const conflict = await db.booking.findFirst({
      where: {
        id: { not: id },
        roomId: booking.roomId,
        status: { not: "CANCELLED" },
        checkIn: { lt: checkOutDate },
        checkOut: { gt: checkInDate },
      },
    });
    if (conflict) {
      return NextResponse.json({ error: "Room is not available for the new dates" }, { status: 409 });
    }

    const room = await db.room.findUnique({ where: { id: booking.roomId } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const updated = await db.booking.update({
      where: { id },
      data: { checkIn: checkInDate, checkOut: checkOutDate, totalPrice: nights * room.pricePerNight },
      include: { room: true },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "No valid update fields" }, { status: 400 });
}
