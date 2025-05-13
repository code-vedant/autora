"use server";

import { Prisma } from "@/generated/client";
import { serializeCarData } from "@/lib/helpers";
import { db } from "@/lib/prisma";
import { Car, UserSavedCar, WorkingHour } from "@/lib/types";
import { auth } from "@clerk/nextjs/server";
import { DealershipInfo } from "@prisma/client";
import { revalidatePath } from "next/cache";

interface CarFiltersResult {
  success: true;
  data: {
    brands: string[];
    bodyTypes: string[];
    fuelTypes: string[];
    transmissions: string[];
    priceRange: {
      min: number;
      max: number;
    };
  };
}

interface GetCarsParamsResult {
  success: true;
  data: ReturnType<typeof serializeCarData>[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

interface GetCarsParams {
  search?: string;
  brand?: string;
  bodyType?: string;
  fuelType?: string;
  transmission?: string;
  minPrice?: string | number;
  maxPrice?: string | number;
  sortBy?: "newest" | "priceAsc" | "priceDesc";
  page?: number;
  limit?: number;
}

export async function getCarFilters(): Promise<CarFiltersResult> {
  try {
    // Get unique brands
    const brands = await db.car.findMany({
      where: { status: "AVAILABLE" },
      select: { brand: true },
      distinct: ["brand"],
      orderBy: { brand: "asc" },
    });

    // Get unique body types
    const bodyTypes = await db.car.findMany({
      where: { status: "AVAILABLE" },
      select: { bodyType: true },
      distinct: ["bodyType"],
      orderBy: { bodyType: "asc" },
    });

    // Get unique fuel types
    const fuelTypes = await db.car.findMany({
      where: { status: "AVAILABLE" },
      select: { fuelType: true },
      distinct: ["fuelType"],
      orderBy: { fuelType: "asc" },
    });

    // Get unique transmissions
    const transmissions = await db.car.findMany({
      where: { status: "AVAILABLE" },
      select: { transmission: true },
      distinct: ["transmission"],
      orderBy: { transmission: "asc" },
    });

    // Get min and max prices using Prisma aggregations
    const priceAggregations = await db.car.aggregate({
      where: { status: "AVAILABLE" },
      _min: { price: true },
      _max: { price: true },
    });

    return {
      success: true,
      data: {
        brands: brands.map((item) => item.brand),
        bodyTypes: bodyTypes.map((item) => item.bodyType),
        fuelTypes: fuelTypes.map((item) => item.fuelType),
        transmissions: transmissions.map((item) => item.transmission),
        priceRange: {
          min: priceAggregations._min.price
            ? parseFloat(priceAggregations._min.price.toString())
            : 0,
          max: priceAggregations._max.price
            ? parseFloat(priceAggregations._max.price.toString())
            : 100000,
        },
      },
    };
  } catch (error: any) {
    console.error("Error fetching car filters:", error);
    throw new Error("Error fetching car filters:" + error.message);
  }
}

export async function getCars({
  search = "",
  brand = "",
  bodyType = "",
  fuelType = "",
  transmission = "",
  minPrice = "",
  maxPrice = "",
  sortBy = "newest", // Options: newest, priceAsc, priceDesc
  page = 1,
  limit = 6,
}: GetCarsParams): Promise<GetCarsParamsResult> {
  try {
    const { userId } = await auth();
    let dbUser = null;

    if (userId) {
      dbUser = await db.user.findUnique({
        where: { clerkUserId: userId },
      });
    }

    // Build where conditions
    let where: Prisma.CarWhereInput= {
      status: "AVAILABLE",
    };

    if (search) {
      where.OR = [
        { brand: { contains: search, mode: "insensitive" } },
        { model: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (brand) where.brand = { equals: brand, mode: "insensitive" };
    if (bodyType) where.bodyType = { equals: bodyType, mode: "insensitive" };
    if (fuelType) where.fuelType = { equals: fuelType, mode: "insensitive" };
    if (transmission)
      where.transmission = { equals: transmission, mode: "insensitive" };

    // Add price range
    where.price = {
      gte: parseFloat(minPrice as string) || 0,
    };

    if (maxPrice && maxPrice) {
      where.price.lte = parseFloat(maxPrice as string);
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Determine sort order
    let orderBy = {};
    switch (sortBy) {
      case "priceAsc":
        orderBy = { price: "asc" };
        break;
      case "priceDesc":
        orderBy = { price: "desc" };
        break;
      case "newest":
      default:
        orderBy = { createdAt: "desc" };
        break;
    }

    // Get total count for pagination
    const totalCars = await db.car.count({ where });

    // Execute the main query
    const cars = await db.car.findMany({
      where,
      take: limit,
      skip,
      orderBy,
    });

    // If we have a user, check which cars are wishlisted
    let wishlisted = new Set<string>();
    if (dbUser) {
      const savedCars = await db.userSavedCar.findMany({
        where: { userId: dbUser.id },
        select: { carId: true },
      });

      wishlisted = new Set(savedCars.map((saved) => saved.carId));
    }

    // Serialize and check wishlist status
    const serializedCars = cars.map((car) =>
      serializeCarData(car, wishlisted.has(car.id))
    );

    return {
      success: true,
      data: serializedCars,
      pagination: {
        total: totalCars,
        page,
        limit,
        pages: Math.ceil(totalCars / limit),
      },
    };
  } catch (error: any) {
    console.error("Error fetching cars:", error);
    throw new Error("Error fetching cars: " + error.message);
  }
}

interface ToggleSavedCarResult {
  success: boolean;
  saved?: boolean;
  message?: string;
  error?: string;
}

/**
 * Toggle car in user's wishlist
 */
export async function toggleSavedCar(carId: string): Promise<ToggleSavedCarResult> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    // Check if car exists
    const car = await db.car.findUnique({
      where: { id: carId },
    });

    if (!car) {
      return {
        success: false,
        error: "Car not found",
      };
    }

    // Check if car is already saved
    const existingSave = await db.userSavedCar.findUnique({
      where: {
        userId_carId: {
          userId: user.id,
          carId,
        },
      },
    });

    // If car is already saved, remove it
    if (existingSave) {
      await db.userSavedCar.delete({
        where: {
          userId_carId: {
            userId: user.id,
            carId,
          },
        },
      });

      revalidatePath(`/saved-cars`);
      return {
        success: true,
        saved: false,
        message: "Car removed from favorites",
      };
    }

    // If car is not saved, add it
    await db.userSavedCar.create({
      data: {
        userId: user.id,
        carId,
      },
    });

    revalidatePath(`/saved-cars`);
    return {
      success: true,
      saved: true,
      message: "Car added to favorites",
    };
  } catch (error: any) {
    console.error("Error toggling saved car:", error);
    throw new Error("Error toggling saved car: " + error.message);
  }
}

interface CarDetailsResultSuccess {
  success: true;
  data: ReturnType<typeof serializeCarData> & {
    testDriveInfo: {
      userTestDrive: {
        id: string;
        status: string;
        bookingDate: string;
      } | null;
      dealership: (DealershipInfo & {
        createdAt: string;
        updatedAt: string;
        workingHours: (WorkingHour & {
          createdAt: string;
          updatedAt: string;
        })[];
      }) | null;
    };
  };
}

interface CarDetailsResultFailure {
  success: false;
  error: string;
}

type CarDetailsResult = CarDetailsResultSuccess | CarDetailsResultFailure;

/**
 * Get car details by ID
 */
export async function getCarById(carId: string): Promise<CarDetailsResult> {
  try {
    // Get current user if authenticated
    const { userId } = await auth();
    let dbUser = null;

    if (userId) {
      dbUser = await db.user.findUnique({
        where: { clerkUserId: userId },
      });
    }

    // Get car details
    const car = await db.car.findUnique({
      where: { id: carId },
    });

    if (!car) {
      return {
        success: false,
        error: "Car not found",
      };
    }

    // Check if car is wishlisted by user
    let isWishlisted = false;
    if (dbUser) {
      const savedCar = await db.userSavedCar.findUnique({
        where: {
          userId_carId: {
            userId: dbUser.id,
            carId,
          },
        },
      });

      isWishlisted = !!savedCar;
    }

    // Check if user has already booked a test drive for this car
    const existingTestDrive = await db.testDriveBooking.findFirst({
      where: {
        carId,
        userId: dbUser?.id,
        status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    let userTestDrive = null;

    if (existingTestDrive) {
      userTestDrive = {
        id: existingTestDrive.id,
        status: existingTestDrive.status,
        bookingDate: existingTestDrive.bookingDate.toISOString(),
      };
    }

    // Get dealership info for test drive availability
    const dealership = await db.dealershipInfo.findFirst({
      include: {
        workingHours: true,
      },
    });

    return {
      success: true,
      data: {
        ...serializeCarData(car, isWishlisted),
        testDriveInfo: {
          userTestDrive,
          dealership: dealership
            ? {
                ...dealership,
                createdAt: dealership.createdAt.toISOString(),
                updatedAt: dealership.updatedAt.toISOString(),
                workingHours: dealership.workingHours.map((hour) => ({
                  ...hour,
                  createdAt: hour.createdAt.toISOString(),
                  updatedAt: hour.updatedAt.toISOString(),
                })),
              }
            : null,
        },
      },
    };
  } catch (error: any) {
    console.error("Error fetching car details:", error);
    return {
      success: false,
      error: "Error fetching car details: " + error.message,
    };
  }
}

interface GetSavedCarsResultSuccess {
  success: true;
  data: ReturnType<typeof serializeCarData>[];
}

interface GetSavedCarsResultFailure {
  success: false;
  error: string;
}

type GetSavedCarsResult = GetSavedCarsResultSuccess | GetSavedCarsResultFailure;

/**
 * Get user's saved cars
 */
export async function getSavedCars(): Promise<GetSavedCarsResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // Get the user from our database
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    // Get saved cars with their details
    const savedCars = await db.userSavedCar.findMany({
      where: { userId: user.id },
      include: {
        car: true,
      },
      orderBy: { savedAt: "desc" },
    });

    // Extract and format car data
    const cars = savedCars.map((saved) => serializeCarData(saved.car,true));

    return {
      success: true,
      data: cars,
    };
  } catch (error: any) {
    console.error("Error fetching saved cars:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}