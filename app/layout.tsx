import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrexaFlow",
  description: "Team communication and workspaces",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var saved = localStorage.getItem('trexaflow_theme');
              var theme = (saved === 'dark' || saved === 'light') ? saved : 'light';
              document.documentElement.setAttribute('data-theme', theme);
            } catch(e) {
              document.documentElement.setAttribute('data-theme', 'light');
            }
          })();
        ` }} />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}