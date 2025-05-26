import { getCarById } from "@/actions/carListing";
import { CarDetails } from "./_components/carDetails";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

type CarRouteParams = { params: { id: string } };

export async function generateMetadata({ params }:any) {
  const { id } = params;
  const result = await getCarById(id);

  if (!result.success) {
    return {
      title: "Car Not Found | Autora",
      description: "The requested car could not be found",
    };
  }

  const car = result.data;

  return {
    title: `${car.year} ${car.brand} ${car.model} | Autora`,
    description: car.description.substring(0, 160),
    openGraph: {
      images: car.images?.[0] ? [car.images[0]] : [],
    },
  };
}

export default async function CarDetailsPage({ params }:any) {
  // Fetch car details
  const { id } =  params;
  const result = await getCarById(id);

  // If car not found, show 404
  if (!result.success) {
    notFound();
  }


  return (
    <div className="container mx-auto px-4 py-2">
      <CarDetails car={result.data} testDriveInfo={result.data.testDriveInfo} />
    </div>
  );
}