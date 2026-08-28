import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>TxTEmpire Shop</title>
        <meta name="description" content="TxTEmpire — Premium Minecraft Texture Packs" />
      </head>
      <body>{children}</body>
    </html>
  );
}
