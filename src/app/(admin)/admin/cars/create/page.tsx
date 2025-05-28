"use client";

import { AddCarForm } from "../_components/addCarForm";

export default function Page() {

  return (
    <div className="w-full p-6 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Add a New Car</h1>
        <AddCarForm/>
    </div>
  );
}
