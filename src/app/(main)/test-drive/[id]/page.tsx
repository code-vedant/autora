import { getCarById } from "@/actions/carListing";
import { notFound } from "next/navigation";
import { TestDriveForm } from "./_components/testDriveForm";

export async function generateMetadata() {
  return {
    title: `Book Test Drive | Autora`,
    description: `Schedule a test drive in few seconds`,
  };
}

// type testDriveProps = { params: { id: string } };

export default async function TestDrivePage({ params } : any) {
  // Fetch car details
  const { id } = params;
  const result = await getCarById(id);

  // If car not found, show 404
  if (!result.success) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-6xl mb-6 ">Book a Test Drive</h1>
      <TestDriveForm
        car={result.data}
        testDriveInfo={result.data.testDriveInfo}
      />
    </div>
  );
}