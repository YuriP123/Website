export default function WikiLayout({ children }) {
  // Sidebar is now handled by WikiStack (client component) for better interactivity
  return (
    <>
      {children}
    </>
  );
}
