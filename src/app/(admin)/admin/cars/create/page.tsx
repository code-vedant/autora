"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "next/router";
import { addCar } from "@/actions/car";
import { AddCarForm } from "../_components/addCarForm";

export default function Page() {

  
  return (
    <div className="w-full p-6 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Add a New Car</h1>
        <AddCarForm/>
    </div>
  );
}
