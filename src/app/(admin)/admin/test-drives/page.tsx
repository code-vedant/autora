import { TestDrivesList } from "./_components/testDriveList";

export const metadata = {
  title: "Test Drives | Autora Admin",
  description: "Manage test drive bookings",
};

export default function TestDrivesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Test Drive Management</h1>
      <TestDrivesList />
    </div>
  );
}