import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Button } from "./ui/button";
import { ArrowLeft, CarFront, Heart } from "lucide-react";

interface HeaderProps {
  isAdmin?: boolean;
}

 const Header: React.FC<HeaderProps> = ({ isAdmin = false }) => {
  return (
    <div className="fixed bg-white/80 drop-shadow-md h-fit w-full py-1 px-4 shadow-md">
      <nav className=" flex items-center justify-between ">
        <Link
          href={isAdmin ? "/admin" : "/"}
          className="flex gap-1 justify-center"
        >
          <Image
            src={"/logo.png"}
            alt="logo"
            width={100}
            height={100}
            className="w-fit h-8"
          />
          <h1 className="text-2xl">Vehqls</h1>
          {isAdmin && <span className="text-xs font-extralight">Admin</span>}
        </Link>
        <div className="flex items-center gap-2">

        {isAdmin ? (
          <Link href={"/"}>
            <Button variant={"outline"}>
              <ArrowLeft size={18} />
              <span className="hidden md:inline">Back to App</span>
            </Button>
          </Link>
        ) : (
          <div>
            <SignedIn>
              <Link href={"/saved-cars"} className="mr-2">
                <Button>
                  <Heart size={18} />
                  <span className="hidden md:inline">Saved Cars</span>
                </Button>
              </Link>
              <Link href={"/reservations"}>
                <Button variant={"outline"}>
                  <CarFront size={18} />
                  <span className="hidden md:inline">My reservation</span>
                </Button>
              </Link>
            </SignedIn>
          </div>
        )}
            <SignedIn>
                <UserButton/>
            </SignedIn>
            <SignedOut>
                <div className="flex gap-2">
                    <SignInButton forceRedirectUrl={"/"}>
                        <Button variant={"outline"}>Login</Button>
                    </SignInButton>
                </div>
            </SignedOut>
        </div>
      </nav>
    </div>
  );
};

export default Header;
