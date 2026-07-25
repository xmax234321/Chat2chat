import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavHeader } from './PhoneShell';
import { AuthLayout } from './AuthLayout';
import { useDeviceLayout } from '../hooks/useDeviceLayout';

export function OnboardingLayout({
  step,
  backTo,
  children,
  footer,
  mobileFooterClassName,
  mobileBodyClassName,
}: {
  step?: string;
  backTo: string;
  children: ReactNode;
  footer?: ReactNode;
  mobileFooterClassName?: string;
  mobileBodyClassName?: string;
}) {
  const navigate = useNavigate();
  const layout = useDeviceLayout();

  if (layout === 'computer') {
    return (
      <AuthLayout onBack={() => navigate(backTo)}>
        <div className="auth-panel-inner">
          {step && <div className="auth-step">{step}</div>}
          {children}
          {footer && <div className="auth-footer">{footer}</div>}
        </div>
      </AuthLayout>
    );
  }

  return (
    <>
      <NavHeader step={step} onBack={() => navigate(backTo)} />
      <div className={`screen-body screen-pad${mobileBodyClassName ? ` ${mobileBodyClassName}` : ''}`}>{children}</div>
      {footer && (
        <div className={`onboarding-mobile-footer${mobileFooterClassName ? ` ${mobileFooterClassName}` : ''}`}>
          {footer}
        </div>
      )}
    </>
  );
}
