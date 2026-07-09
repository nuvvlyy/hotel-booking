import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isReviewEligible, validateReviewInput } from "@/lib/reviews";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const booking = await db.booking.findUnique({ where: { id }, include: { review: true } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (booking.review) {
    return NextResponse.json({ error: "You've already reviewed this booking" }, { status: 409 });
  }
  if (!isReviewEligible(booking)) {
    return NextResponse.json({ error: "This stay hasn't been completed yet" }, { status: 409 });
  }

  const body = await req.json();
  const validated = validateReviewInput(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const review = await db.review.create({
      data: {
        bookingId: booking.id,
        roomId: booking.roomId,
        userId: booking.userId,
        rating: validated.rating,
        comment: validated.comment,
      },
    });
    return NextResponse.json(review, { status: 201 });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "You've already reviewed this booking" }, { status: 409 });
    }
    throw err;
  }
}
