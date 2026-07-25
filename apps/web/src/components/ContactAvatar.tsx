import type { CSSProperties } from 'react';
import type { Contact } from '../lib/types';
import { isSavedMessagesContact } from '../lib/saved-messages';
import { SfBookmarkIcon } from './settings/SettingsSfIcons';

type Props = {
  contact: Contact;
  size?: number;
  iconSize?: number;
  className?: string;
  style?: CSSProperties;
};

export function ContactAvatar({ contact, size = 46, iconSize, className = '', style }: Props) {
  const resolvedIconSize = iconSize ?? Math.round(size * 0.44);
  const sizeStyle: CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.33),
    ...style,
  };

  if (isSavedMessagesContact(contact)) {
    return (
      <div className={`avatar avatar--saved-messages ${className}`.trim()} style={sizeStyle} aria-hidden>
        <SfBookmarkIcon size={resolvedIconSize} color="#5eb3ff" />
      </div>
    );
  }

  return (
    <div className={`avatar ${className}`.trim()} style={sizeStyle}>
      {contact.avatar}
    </div>
  );
}
