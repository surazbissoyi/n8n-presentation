export const metadata = {
  title: "Presenton Clone",
  description: "Generate a presentation from a prompt",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#0f1115", color: "#f2f2f2" }}>
        {children}
      </body>
    </html>
  );
}
