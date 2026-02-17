export const metadata = {
  title: 'Kitchen Odyssey API',
  description: 'Kitchen Odyssey Backend API Server',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
