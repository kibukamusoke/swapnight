import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'SwapNight — Good clothes. New company.', description: 'Bring something you never wear. Find something you will. See it on yourself before you swap. Private clothing swaps, real YouCam previews, and a solo-friendly demo.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
