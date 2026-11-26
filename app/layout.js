import "./globals.css";

export const metadata = {
  title: "YuriOS",
  description: "Recreated in Next.js",
};

export default function RootLayout({ children }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const fontUrl = `${basePath}/fonts/ChicagoFLF.ttf`;

  return (
    <html lang="en">
      <head>
        {/* IndieLogin: proves carcat.org ownership via the GitHub profile's URL field */}
        <link rel="me" href="https://github.com/YuriP123" />
        {/* Where other sites (and Bridgy) send webmentions */}
        <link rel="webmention" href="https://webmention.io/carcat.org/webmention" />
        <link rel="pingback" href="https://webmention.io/carcat.org/xmlrpc" />
      </head>
      <body style={{ '--base-path': basePath, '--font-url': fontUrl }}>
        {children}
      </body>
    </html>
  );
}
