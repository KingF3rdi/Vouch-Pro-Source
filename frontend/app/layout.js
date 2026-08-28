import './globals.css';
import Providers from '../components/Providers';

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>TxTEmpire Shop</title>
        <meta name="description" content="TxTEmpire — Premium Minecraft Texture Packs" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
