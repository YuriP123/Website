import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata = {
  title: "YuriOS",
  description: "Recreated in Next.js",
};

export default function RootLayout({ children }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const fontUrl = `${basePath}/fonts/ChicagoFLF.ttf`;

  return (
    <html lang="en">
      <body style={{ '--base-path': basePath, '--font-url': fontUrl }}>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
