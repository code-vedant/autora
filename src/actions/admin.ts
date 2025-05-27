"use server";

import { BookingStatus, CarStatus } from "@/generated/prisma";
import { serializeCarData } from "@/lib/helper";
import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function getAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user || user.role !== "ADMIN") {
    return { authorized: false, reason: "not-admin" };
  }

  return { authorized: true, user };
}

export async function getAdminTestDrives({
  search = "",
  status,
  excludeStatuses = [],
}: {
  search: string;
  status?: BookingStatus | "ALL"; // for exact match
  excludeStatuses?: BookingStatus[]; // for NOT IN logic
}) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || user.role !== "ADMIN") {
      throw new Error("Unauthorized access");
    }

    type whereType = {
      status?: BookingStatus;
      NOT?: { status?: { in: BookingStatus[] } };
      OR?: Array<{
        car?: {
          OR: Array<{ brand?: { contains: string; mode: "insensitive" }; model?: { contains: string; mode: "insensitive" } }>;
        };
        user?: {
          OR: Array<{ name?: { contains: string; mode: "insensitive" }; email?: { contains: string; mode: "insensitive" } }>;
        };
      }>;
    };

    const where: whereType = {};

if (status && status !== "ALL") {
  where.status = status as BookingStatus;
}


    // Exclude statuses if provided
    if (excludeStatuses && excludeStatuses.length > 0) {
      where.NOT = {
        status: {
          in: excludeStatuses,
        },
      };
    }

    // Add search filters
    if (search) {
      where.OR = [
        {
          car: {
            OR: [
              { brand: { contains: search, mode: "insensitive" } },
              { model: { contains: search, mode: "insensitive" } },
            ],
          },
        },
        {
          user: {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const bookings = await db.testDriveBooking.findMany({
      where,
      include: {
        car: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true,
            phone: true,
          },
        },
      },
      orderBy: [{ bookingDate: "desc" }, { startTime: "asc" }],
    });

    type bookingType = {
      id: string;
      createdAt: Date; 
      updatedAt: Date; 
      userId: string; 
      carId: string; 
      bookingDate: Date; 
      startTime: string; 
      endTime: string; 
      status: BookingStatus; 
      notes: string | null; 
      car: {
        id: string;
        model: string;
      };
      user: {
        id: string;
        name: string | null;
        email: string;
        imageUrl: string | null;
        phone: string | null;
      };
    };
    

    const serializedBookings = bookings.map((booking: bookingType) => ({
      id: booking.id,
      carId: booking.carId,
      car: serializeCarData(booking.car),
      userId: booking.userId,
      user: booking.user,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    }));

    return {
      success: true,
      data: serializedBookings,
      message: "Bookings fetched successfully",
    };
  } catch (error) {
    console.error("Error fetching test driving bookings:", error);
    return {
      success: false,
      message: "Failed to fetch bookings",
    };
  }
}


function isValidBookingStatus(value : BookingStatus): value is BookingStatus {
  return Object.values(BookingStatus).includes(value);
}

export async function updateTestDriveStatus({
  bookingId,
  newStatus,
}: {
  bookingId: string;
  newStatus: BookingStatus;
}) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || user.role !== "ADMIN") {
      throw new Error("Unauthorized access");
    }

    if (!isValidBookingStatus(newStatus)) {
      throw new Error("Invalid booking status");
    }

    const updatedBooking = await db.testDriveBooking.update({
      where: { id: bookingId },
      data: { status: newStatus },
    });

    revalidatePath("/admin/test-drives");
    revalidatePath("/reservations");

    return {
      success: true,
      message: "Test drive status updated successfully",
      data: updatedBooking,
    };
  } catch (error) {
    console.error("Error updating test drive status:", error);
    return {
      success: false,
      message: "Failed to update test drive status",
    };
  }
}

export async function getDashboardData() {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user || user.role !== "ADMIN") {
      throw new Error("Unauthorized access");
    }

    const [cars, testDrives] = await Promise.all([
      db.car.findMany({
        select: {
          id: true,
          status: true,
          featured: true,
        },
      }),

      db.testDriveBooking.findMany({
        select: {
          id: true,
          status: true,
          carId: true,
        },
      }),
    ]);

    type Car = {
        id: string;
        brand: string;
        model: string;
        year: number;
        price: string; // Decimal as string (Prisma returns decimals as string in JS)
        mileage: string;
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

      type TestDriveBooking = {
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

    const totalCars = cars.length;
    const availableCars = cars.filter(
      (car) => car.status === "AVAILABLE"
    ).length;
    const soldCars = cars.filter((car) => car.status === "SOLD").length;
    const unavailableCars = cars.filter(
      (car ) => car.status === "UNAVAILABLE"
    ).length;
    const featuredCars = cars.filter((car) => car.featured === true).length;

    const totalTestDrives = testDrives.length;
    const pendingTestDrives = testDrives.filter(
      (td ) => td.status === "PENDING"
    ).length;
    const confirmedTestDrives = testDrives.filter(
      (td ) => td.status === "CONFIRMED"
    ).length;
    const completedTestDrives = testDrives.filter(
      (td ) => td.status === "COMPLETED"
    ).length;
    const cancelledTestDrives = testDrives.filter(
      (td ) => td.status === "CANCELLED"
    ).length;
    const noShowTestDrives = testDrives.filter(
      (td ) => td.status === "NO_SHOW"
    ).length;

    const completedTestDriveCarIds = testDrives
      .filter((td ) => td.status === "COMPLETED")
      .map((td ) => td.carId);

    const soldCarsAfterTestDrive = cars.filter(
      (car ) =>
        car.status === "SOLD" && completedTestDriveCarIds.includes(car.id)
    ).length;

    const conversionRate =
      completedTestDrives > 0
        ? (soldCarsAfterTestDrive / completedTestDrives) * 100
        : 0;

    return {
      success: true,
      data: {
        cars: {
          total: totalCars,
          available: availableCars,
          sold: soldCars,
          unavailable: unavailableCars,
          featured: featuredCars,
        },
        testDrives: {
          total: totalTestDrives,
          pending: pendingTestDrives,
          confirmed: confirmedTestDrives,
          completed: completedTestDrives,
          cancelled: cancelledTestDrives,
          noShow: noShowTestDrives,
          conversionRate: parseFloat(conversionRate.toFixed(2)),
        },
      },
    };
  } catch (error) {
    console.error("Error fetching dashboard data");
    return {
      success: false,
      error: error,
    };
  }
}
