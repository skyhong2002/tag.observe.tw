import { permanentRedirect } from 'next/navigation';

// /liveboard/settings/ is an easy slip for the settings page, /liveboard/setting/.
export default function LiveboardSettingsAlias() {
  permanentRedirect('/liveboard/setting/');
}
