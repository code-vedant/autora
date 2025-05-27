"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/prisma";
import aj from "../lib/arcjet";
import { request } from "@arcjet/next";
import { Car } from "@/generated/prisma";
import { getErrorMessage } from "@/lib/errors";

interface SerializedCar {
  id: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  price: number;
  mileage: string;
  seats: string;
  bodyType: string;
  fuelType: string;
  transmission: string;
  description: string;
  status: string;
  featured: boolean;
  images: string[];
  createdAt?: string;
  updatedAt?: string;
}

// Function to serialize car data
function serializeCarData(car: Car): SerializedCar {
  return {
    id: car.id,
    brand: car.brand,
    model: car.model,
    year: car.year,
    color: car.color,
    price: car.price ? parseFloat(car.price.toString()) : 0,
    mileage: car.mileage,
    seats: car.seats ? car.seats.toString() : "N/A",
    bodyType: car.bodyType,
    fuelType: car.fuelType,
    transmission: car.transmission,
    description: car.description,
    status: car.status,
    featured: car.featured,
    images: car.images || [],
    createdAt: car.createdAt?.toISOString(),
    updatedAt: car.updatedAt?.toISOString(),
  };
}

type FeaturedCarsResult = SerializedCar[];

/**
 * Get featured cars for the homepage
 */
export async function getFeaturedCars(limit: number = 3): Promise<FeaturedCarsResult> {
  try {
    const cars = await db.car.findMany({
      where: {
        featured: true,
        status: "AVAILABLE",
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return cars.map(serializeCarData);
  } catch (error) {
    throw new Error("Error fetching featured cars: " + getErrorMessage(error));
  }
}

// Function to convert File to base64
async function fileToBase64(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  return buffer.toString("base64");
}

interface CarDetails {
  brand: string;
  model: string;
  year: number;
  color: string;
  price: string;
  mileage: string;
  seats: string;
  bodyType: string;
  fuelType: string;
  transmission: string;
  description: string;
  confidence: number;
}

interface ImageSearchResultSuccess {
  success: true;
  data: CarDetails;
}

interface ImageSearchResultFailure {
  success: false;
  error: string;
}

type ImageSearchResult = ImageSearchResultSuccess | ImageSearchResultFailure;

/**
 * Process car image with Gemini AI
 */
export async function processImageSearch(file: File): Promise<ImageSearchResult> {
  try {
    // Get request data for ArcJet
    const req = await request();

    // Check rate limit
    const decision = await aj.protect(req, {
      requested: 1, // Specify how many tokens to consume
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        const { remaining, reset } = decision.reason;
        console.error({
          code: "RATE_LIMIT_EXCEEDED",
          details: {
            remaining,
            resetInSeconds: reset,
          },
        });

        return {
          success: false,
          error: "Too many requests. Please try again later.",
        };
      }

      return {
        success: false,
        error: "Request blocked",
      };
    }

    // Check if API key is available
    if (!process.env.GEMINI_API_KEY) {
      return {
        success: false,
        error: "Gemini API key is not configured",
      };
    }

    // Initialize Gemini API
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Convert image file to base64
    const base64Image = await fileToBase64(file);

    // Create image part for the model
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: file.type,
      },
    };

    // Define the prompt for car search extraction
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

    // Get response from Gemini
    const result = await model.generateContent([imagePart, prompt]);
    const response = await result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    // Parse the JSON response
    try {
      const carDetails = JSON.parse(cleanedText) as CarDetails;

      // Return success response with data
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
    console.error("AI Search error:", error);
    return {
      success: false,
      error: "AI Search error: " + getErrorMessage(error),
    };
  }
}