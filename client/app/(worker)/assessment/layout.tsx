import "./globals.css";


export default function AssessmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#FAFAFA] text-[#242424] antialiased">
        {/* No Sidebar, No Header. Just the game. */}
        {children}
      </body>
    </html>
  );
}