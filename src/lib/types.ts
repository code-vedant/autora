// types.ts
import { CarStatus, BookingStatus, DayOfWeek, UserRole } from "@prisma/client";

export type { CarStatus, BookingStatus, DayOfWeek, UserRole };

// --- User ---
export type User = {
  id: string;
  clerkUserId: string;
  email: string;
  name?: string | null;
  imageUrl?: string | null;
  phone?: string | null;
  createdAt: Date;
  updatedAt: Date;
  role: UserRole;
};

// --- Car ---
export type Car = {
  id: string;
  brand: string;
  model: string;
  year: number;
  price: string; // Decimal as string (Prisma returns decimals as string in JS)
  mileage: number;
  color: string;
  fuelType: string;
  transmission: string;
  bodyType: string;
  seats?: number | null;
  description: string;
  status: CarStatus;
  featured: boolean;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
};

// --- DealershipInfo ---
export type DealershipInfo = {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};

// --- WorkingHour ---
export type WorkingHour = {
  id: string;
  dealershipId: string;
  dayOfWeek: DayOfWeek;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// --- UserSavedCar ---
export type UserSavedCar = {
  id: string;
  userId: string;
  carId: string;
  savedAt: Date;
};

// --- TestDriveBooking ---
export type TestDriveBooking = {
  id: string;
  carId: string;
  userId: string;
  bookingDate: Date;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
};
