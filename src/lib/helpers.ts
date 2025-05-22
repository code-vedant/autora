import { Car } from "./types";

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
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