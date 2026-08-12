import type { Metadata } from "next";
import { ReactNode } from "react";

import "./globals.css";
import { Providers } from "../src/app/providers";

export const metadata: Metadata = { title: "AidTrail | Follow funding to impact", description: "Explore community grants, public evidence, and simulated Studionet GEN escrow." };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) { return <html lang="en"><body><Providers>{children}</Providers></body></html>; }
