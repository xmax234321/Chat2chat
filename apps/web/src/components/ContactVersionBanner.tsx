import { useEffect, useState } from 'react';
import type { Contact } from '../lib/types';
import {
  contactVersionInfo,
  dismissContactVersionBanner,
  formatClientVersion,
  getClientVersion,
  isContactOnOlderApp,
  isContactVersionBannerDismissed,
  type ClientVersionInfo,
} from '../lib/client-version';

type Props = {
  contact: Contact;
};

export function ContactVersionBanner({ contact }: Props) {
  const [current, setCurrent] = useState<ClientVersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    void getClientVersion().then(setCurrent);
  }, []);

  const peer = contactVersionInfo(contact);
  useEffect(() => {
    if (!peer) return;
    setDismissed(isContactVersionBannerDismissed(contact.userId, peer));
  }, [contact.userId, peer?.version, peer?.build]);

  if (!current || !peer || !isContactOnOlderApp(contact, current) || dismissed) return null;

  return (
    <button
      type="button"
      className="contact-version-banner"
      role="status"
      aria-label="Dismiss outdated version notice"
      onClick={() => {
        dismissContactVersionBanner(contact.userId, peer);
        setDismissed(true);
      }}
    >
      This contact is using an older version of Chat2Chat ({formatClientVersion(peer)}). Some features may not work
      until they update. Tap to dismiss.
    </button>
  );
}
