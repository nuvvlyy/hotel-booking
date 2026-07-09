import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const adapter = new PrismaLibSql({ url: "file:dev.db" });
const db = new PrismaClient({ adapter });

async function main() {
  // Admin user
  await db.user.upsert({
    where: { email: "admin@hotel.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@hotel.com",
      password: await bcrypt.hash("admin123", 12),
      role: "admin",
    },
  });

  // Demo guest
  await db.user.upsert({
    where: { email: "guest@hotel.com" },
    update: {},
    create: {
      name: "John Guest",
      email: "guest@hotel.com",
      password: await bcrypt.hash("guest123", 12),
      role: "guest",
    },
  });

  const rooms = [
    {
      name: "Standard Single",
      type: "single",
      description: "A cozy room for solo travelers, featuring a comfortable single bed, work desk, and city view.",
      pricePerNight: 79,
      capacity: 1,
      amenities: "WiFi, TV, Air Conditioning, Work Desk",
    },
    {
      name: "Deluxe Double",
      type: "double",
      description: "Spacious room with a queen-sized bed, en-suite bathroom, and a balcony overlooking the garden.",
      pricePerNight: 129,
      capacity: 2,
      amenities: "WiFi, TV, Mini Bar, Balcony, Air Conditioning",
    },
    {
      name: "Family Suite",
      type: "suite",
      description: "Perfect for families, this suite includes two bedrooms, a living area, and a kitchenette.",
      pricePerNight: 249,
      capacity: 4,
      amenities: "WiFi, TV, Kitchenette, Living Area, Air Conditioning, Bathtub",
    },
    {
      name: "Luxury Deluxe King",
      type: "deluxe",
      description: "The ultimate stay — king bed, panoramic views, luxury amenities, and dedicated butler service.",
      pricePerNight: 399,
      capacity: 2,
      amenities: "WiFi, TV, Mini Bar, Jacuzzi, Panoramic View, Butler Service, Air Conditioning",
    },
    {
      name: "Executive Double",
      type: "double",
      description: "Designed for business travelers. Includes a large work area, high-speed WiFi, and express laundry.",
      pricePerNight: 159,
      capacity: 2,
      amenities: "WiFi, TV, Work Desk, Express Laundry, Air Conditioning, Safe",
    },
    {
      name: "Budget Single",
      type: "single",
      description: "Affordable and clean room for budget-conscious travelers. All essentials included.",
      pricePerNight: 49,
      capacity: 1,
      amenities: "WiFi, TV, Air Conditioning",
    },
  ];

  for (const room of rooms) {
    await db.room.upsert({
      where: { id: room.name },
      update: {},
      create: { id: room.name, ...room },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
