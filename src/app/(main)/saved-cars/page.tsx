import { getSavedCars } from "@/actions/carListing";
import { SavedCarsList } from "./_components/savedCarsList";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Saved Cars | Autora",
  description: "View your saved cars and favorites",
};

export default async function SavedCarsPage() {
  // Check authentication on server
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect=/saved-cars");
  }

  // Fetch saved cars on the server
  const savedCarsResult = await getSavedCars();

  console.log("Saved Cars Result:", savedCarsResult);
  

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-6xl mb-6 gradient-title">Your Saved Cars</h1>
      <SavedCarsList initialData={savedCarsResult} />
    </div>
  );
}