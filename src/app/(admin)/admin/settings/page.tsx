import { SettingsForm } from "./_components/settingsForm";

export const metadata = {
  title: "Settings | Autora Admin",
  description: "Manage dealership working hours and admin users",
};

export default function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <SettingsForm />
    </div>
  );
}