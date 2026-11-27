import "./globals.css";

// Browser translators (Chrome/Google Translate, Edge, etc.) swap text nodes
// for their own <font> wrappers. React still holds the original nodes and
// throws "Failed to execute 'removeChild'/'insertBefore' on 'Node'" when it
// later updates them, which takes down the whole page. Ignore those stale
// references instead of crashing. See facebook/react#11538.
const translateGuard = `(function () {
  if (typeof Node !== 'function' || !Node.prototype) return;
  var removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) return child;
    return removeChild.apply(this, arguments);
  };
  var insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      return insertBefore.call(this, newNode, null);
    }
    return insertBefore.apply(this, arguments);
  };
})();`;

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
        {/* Must run before React hydrates, so it stays an inline script */}
        <script dangerouslySetInnerHTML={{ __html: translateGuard }} />
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
