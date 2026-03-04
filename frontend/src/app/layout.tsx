import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "RoomBook — Enterprise Room Booking",
  description: "Internal room booking system for enterprise teams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://appsforoffice.microsoft.com/lib/1.1/hosted/office.js"
          strategy="beforeInteractive"
        />
        <Script id="office-init" strategy="beforeInteractive">
          {`if (typeof Office !== 'undefined') { Office.onReady(function() { console.log('Office.js ready'); }); }`}
        </Script>
      </head>
      <body className="min-h-screen bg-gray-50">
        <Providers>
          {children}
          <Toaster position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
