import './globals.css';
import Providers from '../components/Providers';

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#120a14" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <title>TxTEmpire Shop</title>
        <meta name="description" content="TxTEmpire — Premium Minecraft Texture Packs" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
