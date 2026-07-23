import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "暮光跃境 · Twilight Leap";
const description =
  "穿越余烬古城，在光影交错的原创像素世界中收集星辉、越过敌人并抵达星门。";

function firstForwardedValue(value: string | null): string | null {
  return value?.split(",", 1)[0]?.trim() || null;
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    firstForwardedValue(requestHeaders.get("x-forwarded-host")) ??
    firstForwardedValue(requestHeaders.get("host")) ??
    "localhost:3000";
  const protocol =
    firstForwardedValue(requestHeaders.get("x-forwarded-proto")) ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const socialImage = new URL("/og.png", metadataBase).toString();

  return {
    metadataBase,
    title,
    description,
    openGraph: {
      type: "website",
      locale: "zh_CN",
      siteName: "暮光跃境",
      title,
      description,
      images: [
        {
          url: socialImage,
          width: 1731,
          height: 909,
          alt: "暮光跃境像素冒险：暮色古城、星辉、旅者与星门",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#160f1b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
