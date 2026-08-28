import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <head>
        <title>TxTEmpire Shop</title>
        <meta name="description" content="TxTEmpire — Texture Packs, Shader & mehr" />
      </head>
      <body>{children}</body>
    </html>
  );
}
