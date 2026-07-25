import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/components/auth-provider";

export const metadata: Metadata = {
  title: {
    default: "Forms — Beautiful Conversational Forms",
    template: "%s · Forms",
  },
  description:
    "Create beautiful, conversational forms that feel like a natural conversation. Like Typeform, but yours.",
  keywords: ["forms", "surveys", "typeform", "conversational", "questionnaires"],
  authors: [{ name: "Forms" }],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "Forms — Beautiful Conversational Forms",
    description:
      "Create beautiful, conversational forms that feel like a natural conversation.",
    type: "website",
    siteName: "Forms",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
