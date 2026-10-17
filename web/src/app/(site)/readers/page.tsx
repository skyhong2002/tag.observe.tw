import { permanentRedirect } from 'next/navigation';

// 讀者關注 is now a section of 本站流量 and a panel on the home page.
export default function ReadersPage() {
  permanentRedirect('/observe/#readers');
}
