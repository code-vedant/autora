import { CarStatus } from "@/generated/prisma";

type Car = {
    id: string;
    brand: string;
    model: string;
    year: number;
    price: string;
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

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

interface SerializedCar {
  [key: string]: any;
  price: number;
  createdAt?: string;
  updatedAt?: string;
}



export const serializeCarData = (car: any , wishlisted?: boolean) => {
  return {
    ...car,
    price: car.price ? parseFloat(car.price.toString()) : 0,
    createdAt: car.createdAt?.toISOString(),
    updatedAt: car.updatedAt?.toISOString(),
    wishlisted,
  };
};