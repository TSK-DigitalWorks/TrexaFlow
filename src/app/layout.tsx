export const metadata = {
  title: "TrexaFlow",
  description: "TrexaFlow workspace",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
