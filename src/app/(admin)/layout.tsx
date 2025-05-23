import { ReactNode } from "react";
import notFound  from "../notFound";
import { Sidebar } from "./admin/_components/sidebar";
import { getAdmin } from "@/actions/admin";
import Header from "../../components/header";

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {

  const admin = await getAdmin();

  if(!admin.authorized) {
    return notFound();
  }

  return (
    <div className="h-full">
      <div className="flex h-full w-56 flex-col fixed inset-y-0 z-40">
        <Sidebar />
      </div>
      <main className="md:pl-56 pt-[80px] h-full">{children}</main>
    </div>
  );
}
