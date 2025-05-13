"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/prisma";
import { createClient } from "@/lib/supabase";
import { auth } from "@clerk/nextjs/server";
import { serializeCarData } from "@/lib/helpers";
import { Car } from "@/lib/types";
import { CarStatus } from "@/generated/client/enums";

// -------------------- Types --------------------
interface CarDetails {
  brand: string;
  model: string;
  year: number;
  color: string;
  price: string;
  mileage: string;
  bodyType: string;
  fuelType: string;
  transmission: string;
  description: string;
  confidence: number;
}

interface CarInput {
  brand: string;
  model: string;
  year: number;
  price: string;
  mileage: number;
  color: string;
  fuelType: string;
  transmission: string;
  bodyType: string;
  seats?: number;
  description: string;
  status: CarStatus;
  featured: boolean;
}

interface UpdateCarStatusInput {
  status?: string;
  featured?: boolean;
}

// -------------------- File to base64 --------------------
async function fileToBase64(file: Blob): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  return buffer.toString("base64");
}

// -------------------- AI Image Processing --------------------
export async function processCarImageWithAI(file: Blob): Promise<{ success: boolean; data?: CarDetails; error?: string }> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key is not configured");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const base64Image = await fileToBase64(file);

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: file.type,
      },
    };

    const prompt = `
      Analyze this car image and extract the following information:
      ...
      Format your response as a clean JSON object with these fields:
      {
        "brand": "",
        "model": "",
        ...
      }
    `;

    const result = await model.generateContent([imagePart, prompt]);
    const response = await result.response;
    const text = response.text().replace(/```(?:json)?\n?/g, "").trim();

    try {
      const carDetails: CarDetails = JSON.parse(text);

      const requiredFields = [
        "brand", "model", "year", "color", "bodyType", "price", "mileage",
        "fuelType", "transmission", "description", "confidence"
      ];

      const missingFields = requiredFields.filter((f) => !(f in carDetails));
      if (missingFields.length > 0) {
        throw new Error(`Missing fields: ${missingFields.join(", ")}`);
      }

      return { success: true, data: carDetails };
    } catch {
      return { success: false, error: "Failed to parse AI response" };
    }
  } catch (error: any) {
    throw new Error("Gemini API error: " + error.message);
  }
}

// -------------------- Add Car --------------------
export async function addCar({
  carData,
  images,
}: {
  carData: CarInput;
  images: string[];
}): Promise<{ success: boolean }> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({ where: { clerkUserId: userId } });
    if (!user) throw new Error("User not found");

    const carId = uuidv4();
    const folderPath = `cars/${carId}`;
    const supabase = createClient(cookies());

    const imageUrls: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const base64Data = images[i];
      if (!base64Data || !base64Data.startsWith("data:image/")) continue;

      const base64 = base64Data.split(",")[1];
      const buffer = Buffer.from(base64, "base64");
      const match = base64Data.match(/data:image\/([a-zA-Z0-9]+);/);
      const ext = match?.[1] || "jpeg";
      const fileName = `image-${Date.now()}-${i}.${ext}`;
      const path = `${folderPath}/${fileName}`;

      const { error } = await supabase.storage
        .from("car-images")
        .upload(path, buffer, {
          contentType: `image/${ext}`,
        });

      if (error) throw new Error(`Upload failed: ${error.message}`);

      imageUrls.push(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/car-images/${path}`
      );
    }

    if (!imageUrls.length) throw new Error("No valid images uploaded");

    await db.car.create({
      data: {
        id: carId,
        ...carData,
        images: imageUrls,
      },
    });

    revalidatePath("/admin/cars");
    return { success: true };
  } catch (error: any) {
    throw new Error("Error adding car: " + error.message);
  }
}

// -------------------- Get Cars --------------------
export async function getCars(
  search = ""
): Promise<{ success: boolean; data?: Car[]; error?: string }> {
  try {
    const where: any = {};
    if (search) {
      where.OR = [
        { brand: { contains: search, mode: "insensitive" } },
        { model: { contains: search, mode: "insensitive" } },
        { color: { contains: search, mode: "insensitive" } },
      ];
    }

    const cars = await db.car.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: cars.map((car) => serializeCarData(car, false)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// -------------------- Delete Car --------------------
export async function deleteCar(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const car = await db.car.findUnique({ where: { id }, select: { images: true } });
    if (!car) return { success: false, error: "Car not found" };

    await db.car.delete({ where: { id } });

    try {
      const supabase = createClient(cookies());
      const filePaths = car.images
        .map((url : string) => {
          const match = new URL(url).pathname.match(/\/car-images\/(.*)/);
          return match?.[1] ?? null;
        })
        .filter(Boolean) as string[];

      if (filePaths.length) {
        await supabase.storage.from("car-images").remove(filePaths);
      }
    } catch (err) {
      console.error("Supabase storage deletion error", err);
    }

    revalidatePath("/admin/cars");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// -------------------- Update Car Status --------------------
export async function updateCarStatus(
  id: string,
  { status, featured }: UpdateCarStatusInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (featured !== undefined) updateData.featured = featured;

    await db.car.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/admin/cars");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
