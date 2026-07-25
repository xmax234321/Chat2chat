import type { CSSProperties } from 'react';
import {
  SFArrowshapeBackwardCircle,
  SFArrowTriangleheadClockwiseRotate90,
  SFAntennaRadiowavesLeftAndRight,
  SFBellBadge,
  SFBookmark,
  SFCameraFill,
  SFCrop,
  SFHandRaised,
  SFIcloud,
  SFLock,
  SFMicrophoneFill,
  SFPaintbrush,
  SFPhoto,
  SFPencil,
  SFPaperplaneFill,
  SFQrcode,
  SFRepeatCircle,
  SFShield,
  SFVideo,
} from 'sf-symbols-lib/monochrome';

type IconProps = { size?: number; color?: string; className?: string };

function iconStyle(color: string): CSSProperties {
  return { color, display: 'block' };
}

export function SfShieldIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return <SFShield size={size} className={className} style={iconStyle(color)} aria-hidden />;
}

export function SfIcloudIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return <SFIcloud size={size} className={className} style={iconStyle(color)} aria-hidden />;
}

export function SfUpdateIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return (
    <SFArrowTriangleheadClockwiseRotate90 size={size} className={className} style={iconStyle(color)} aria-hidden />
  );
}

export function SfBellBadgeIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return <SFBellBadge size={size} className={className} style={iconStyle(color)} aria-hidden />;
}

export function SfPaintbrushIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return <SFPaintbrush size={size} className={className} style={iconStyle(color)} aria-hidden />;
}

export function SfLogoutCircleIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return <SFArrowshapeBackwardCircle size={size} className={className} style={iconStyle(color)} aria-hidden />;
}

export function SfBookmarkIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return <SFBookmark size={size} className={className} style={iconStyle(color)} aria-hidden />;
}

export function SfLockIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return <SFLock size={size} className={className} style={iconStyle(color)} aria-hidden />;
}

export function SfPencilIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return <SFPencil size={size} className={className} style={iconStyle(color)} aria-hidden />;
}

export function SfPaperplaneIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return <SFPaperplaneFill size={size} className={className} style={iconStyle(color)} aria-hidden />;
}

export function SfCropIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return <SFCrop size={size} className={className} style={iconStyle(color)} aria-hidden />;
}

export function SfQrcodeIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return <SFQrcode size={size} className={className} style={iconStyle(color)} aria-hidden />;
}

export function SfRepeatCircleIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return <SFRepeatCircle size={size} className={className} style={iconStyle(color)} aria-hidden />;
}

export function SfHandRaisedIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return <SFHandRaised size={size} className={className} style={iconStyle(color)} aria-hidden />;
}

export function SfAntennaIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return (
    <SFAntennaRadiowavesLeftAndRight size={size} className={className} style={iconStyle(color)} aria-hidden />
  );
}

export function SfPhotoIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return <SFPhoto size={size} className={className} style={iconStyle(color)} aria-hidden />;
}

export function SfVideoIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return <SFVideo size={size} className={className} style={iconStyle(color)} aria-hidden />;
}

export function SfCameraFillIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return <SFCameraFill size={size} className={className} style={iconStyle(color)} aria-hidden />;
}

export function SfMicrophoneFillIcon({ size = 20, color = 'currentColor', className }: IconProps) {
  return <SFMicrophoneFill size={size} className={className} style={iconStyle(color)} aria-hidden />;
}
