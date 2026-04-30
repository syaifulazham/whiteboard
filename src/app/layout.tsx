import type { Metadata } from "next";
import "./globals.css";
import "tldraw/tldraw.css";
import "katex/dist/katex.min.css";
import NextAuthSessionProvider from "@/components/SessionProvider";
import LayoutShell from "@/components/LayoutShell";

export const metadata: Metadata = {
  title: "Smart Whiteboard",
  description: "AI-integrated smart whiteboard powered by Gemini",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-full overflow-hidden bg-white">
        <NextAuthSessionProvider>
          <LayoutShell>{children}</LayoutShell>
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}
