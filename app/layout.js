import "./globals.css";

export const metadata = {
  title: "YuriOS",
  description: "Recreated in Next.js",
};

export default function RootLayout({ children }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  return (
    <html lang="en">
      <body style={{ '--base-path': basePath }}>
        {children}
      </body>
    </html>
  );
}
