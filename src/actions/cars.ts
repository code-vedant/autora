"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/prisma";
import { createClient } from "@/lib/supabase";
import { auth } from "@clerk/nextjs/server";
import { serializeCarData } from "@/lib/helper";
import { Car, CarStatus } from "@/generated/prisma";
import { getErrorMessage } from "@/lib/errors";

export async function processImagewithAI(file: File) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key is not set");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const base64Image = await fileToBase64(file);

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: file.type,
      },
    };
    const prompt = `
      Analyze this car image and extract the following information:
      1. brand (manufacturer)
      2. Model
      3. Year (approximately)
      4. Color (primary major color only)
      5. Body type (SUV, Sedan, Hatchback, etc.)
      6. Mileage in kmpl with unit 'kmpl' or N/A if not available or electric per charge distance
      7. Fuel type (your best guess)
      8. no of seats
      9. Transmission type (your best guess)
      10. Price (your best guess) in Indian rupees , just give number
      11. Short Description as to be added to a car listing

      Format your response as a clean JSON object with these fields:
      {
        "brand": "",
        "model": "",
        "year": 0000,
        "color": "",
        "price": "",
        "mileage": "",
        "seats":"",
        "bodyType": "",
        "fuelType": "",
        "transmission": "",
        "description": "",
        "confidence": 0.0
      }

      For confidence, provide a value between 0 and 1 representing how confident you are in your overall identification.
      Only respond with the JSON object, nothing else.
    `;

    const result = await model.generateContent([imagePart, prompt]);
    const response = result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    try {
      const carDetails = JSON.parse(cleanedText);

      const reqFields = [
        "brand",
        "model",
        "year",
        "color",
        "price",
        "mileage",
        "bodyType",
        "fuelType",
        "transmission",
        "description",
        "confidence",
      ];

      const missingFields = reqFields.filter((field) => !(field in carDetails));
      if (missingFields.length > 0) {
        throw new Error(`Missing fields: ${missingFields.join(", ")}`);
      }

      return {
        success: true,
        data: carDetails,
      };
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return {
        success: false,
        error: "Failed to parse AI response",
      };
    }
  } catch (error) {
    console.error("Error processing image with AI:", error);
    return {
      success: false,
      error: "Error processing image with AI: " + getErrorMessage(error),
    };
    
  }
}

interface CarData {
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  color: string;
  fuelType: string;
  transmission: string;
  bodyType: string;
  seats: number;
  description: string;
  status: CarStatus;
  featured: boolean;
}

async function fileToBase64(file: File) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  return buffer.toString("base64");
}

export async function addCar({
  carData,
  images,
}: {
  carData: CarData;
  images: string[];
}) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({ where: { clerkUserId: userId } });
    if (!user) throw new Error("User not found");

    const carId = uuidv4();
    const folderPath = `cars/${carId}`;
    const supabase = await createClient();
    const imageUrls: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const base64Data = images[i];
      if (!base64Data || !base64Data.startsWith("data:image/")) continue;

      const base64 = base64Data.split(",")[1];
      const imageBuffer = Buffer.from(base64, "base64");
      const mimeMatch = base64Data.match(/data:image\/([a-zA-Z0-9]+);/);
      const fileExtension = mimeMatch ? mimeMatch[1] : "jpeg";
      const fileName = `image-${Date.now()}-${i}.${fileExtension}`;
      const filePath = `${folderPath}/${fileName}`;

      const { error } = await supabase.storage
        .from("car-images")
        .upload(filePath, imageBuffer, {
          contentType: `image/${fileExtension}`,
        });

      if (error) throw new Error(`Failed to upload image: ${error.message as string}`);

      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/car-images/${filePath}`;
      imageUrls.push(publicUrl);
    }

    if (imageUrls.length === 0) {
      throw new Error("No valid images were uploaded");
    }


    // Validate the status value, if it's provided
    const status = carData.status;
    if (status && !Object.values(CarStatus).includes(status as CarStatus)) {
      throw new Error("Invalid status value");
    }

    await db.car.create({
      data: {
        id: carId,
        ...carData,
        mileage: String(carData.mileage),
        status: status as CarStatus | undefined, // Explicitly cast to CarStatus enum
        images: imageUrls,
      },
    });

    revalidatePath("/admin/cars");

    return { success: true };
  } catch (error) {
      console.error("Error adding car details:", error);
      return {
        success: false,
        error: "Error adding car details: " + getErrorMessage(error),
      };
    }
}

export async function getCars(search = "") {
  try {
    type whereType = {
      OR?: Array<{
        brand?: { contains: string; mode: "insensitive" };
        model?: { contains: string; mode: "insensitive" };
        color?: { contains: string; mode: "insensitive" };
      }>;
    };

    let where: whereType = {};

    if (search) {
      where = {
        OR: [
          {
            brand: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            model: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            color: {
              contains: search,
              mode: "insensitive",
            },
          },
        ],
      };
    }

    const cars = await db.car.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    

    const serializedCars = cars.map((car : Car) => {
      return serializeCarData(car);
    });

    return {
      success: true,
      cars: serializedCars,
    };
  } catch (error) {
    console.error("Error fetching cars:", error);
    return { 
      success : false,
      error: "Error fetching cars: " + getErrorMessage(error)
    }
  }
}

export async function deleteCar(id: string) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const car = await db.car.findUnique({
      where: { id },
      select: { images: true },
    });

    if (!car) {
      return {
        success: false,
        error: "Car not found",
      };
    }

    await db.car.delete({
      where: { id },
    });

    try {

      const supabase = await createClient();

      const filePaths = car.images
        .map((imageUrl : string) => {
          const url = new URL(imageUrl);
          const pathMatch = url.pathname.match(/\/car-images\/(.*)/);
          return pathMatch ? pathMatch[1] : null;
        })
        .filter((path): path is string => path !== null);

      if (filePaths.length > 0) {
        const { error } = await supabase.storage
          .from("car-images")
          .remove(filePaths);

        if (error) {
          console.error("Error deleting images:", error);
        }
      }
    } catch (storageError) {
      console.error("Error with storage operations:", storageError);
    }

    revalidatePath("/admin/cars");

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting car:", error);
    return {
      success: false,
      error: "Error deleting car: " + getErrorMessage(error),
    };
  }
}

export async function updateCarStatus(id : string, { status, featured } : { status?: CarStatus, featured?: boolean }) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    type UpdateData = {
      status?: typeof status;
      featured?: typeof featured;
    };
    
    const updateData: UpdateData = {};
    
    if (status !== undefined) {
      updateData.status = status;
    }
    
    if (featured !== undefined) {
      updateData.featured = featured;
    }

    // Update the car
    await db.car.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/admin/cars");

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error updating car status:", error);
    return {
      success: false,
      error: "Error updating car status" + getErrorMessage(error),
    };
  }
}