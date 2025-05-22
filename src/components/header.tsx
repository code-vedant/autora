
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "./ui/button";
import { Heart, CarFront, Layout, ArrowLeft } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { checkUser } from "@/lib/check-user";



const Header = async () => {
  const user = await checkUser();
  const isAdminPage = user?.role === "ADMIN";

  return (
    <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b">
      <nav className="mx-auto px-4 py-1 flex items-center justify-between">
        <Link href={isAdminPage ? "/admin" : "/"} className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Autora Logo"
            width={200}
            height={60}
            className="h-12 w-auto object-contain"
          />
          <h1 className="text-3xl font-bold">Autora</h1>
          {isAdminPage && (
            <span className="text-xs font-extralight mt-2">admin</span>
          )}
        </Link>

        <div className="flex items-center space-x-4">
          {isAdminPage ? (
            <Link href="/">
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft size={18} />
                <span>Back to App</span>
              </Button>
            </Link>
          ) : (
            <SignedIn>
              <div className="flex items-center gap-2">
                <Link href="/saved-cars">
                  <Button className="flex items-center gap-2">
                    <Heart size={18} />
                    <span className="hidden md:inline">Saved Cars</span>
                  </Button>
                </Link>

                {!isAdminPage && (
                  <Link href="/reservations">
                    <Button variant="outline" className="flex items-center gap-2">
                      <CarFront size={18} />
                      <span className="hidden md:inline">My Reservations</span>
                    </Button>
                  </Link>
                )}

                {isAdminPage && (
                  <Link href="/admin">
                    <Button variant="outline" className="flex items-center gap-2">
                      <Layout size={18} />
                      <span className="hidden md:inline">Admin Portal</span>
                    </Button>
                  </Link>
                )}
              </div>
            </SignedIn>
          )}

          <SignedOut>
            {!isAdminPage && (
              <div className="flex items-center gap-2">
                <SignUpButton>
                  <Button variant="outline">Sign up</Button>
                </SignUpButton>
                <SignInButton forceRedirectUrl="/">
                  <Button>Login</Button>
                </SignInButton>
              </div>
            )}
          </SignedOut>

          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-10 h-10",
                },
              }}
            />
          </SignedIn>
        </div>
      </nav>
    </header>
  );
};

export default Header;
