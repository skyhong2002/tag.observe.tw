import { permanentRedirect } from 'next/navigation';

// 讀者關注 is now a section of 網站觀測 and a panel on the home page.
export default function ReadersPage() {
  permanentRedirect('/observe/#readers');
}
