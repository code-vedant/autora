import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import Header from "@/components/header";
import { Footer } from "@/components/footer";

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "AUTORA | Find your dream car",
  description: "Find and get your dream Car",
  icons:{
    icon: "/favicon.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
   
      <ClerkProvider>
         <html lang="en">

        <body className={inter.className} >
          <Header/>
          {children}
          <Footer/>
          </body>
        </html>
      </ClerkProvider>
      
    
  );
}
