import { useState } from 'react';
import { PinPad } from './PinPad';
import { PasscodeTypeSheet } from './PasscodeTypeSheet';
import type { AppLockPasscodeType } from '../lib/app-lock';
import { loadAppLockPasscodeType, passcodeTypeLabel } from '../lib/app-lock';

type Step = 'pin' | 'confirm' | 'current';

type CreateProps = {
  mode: 'create';
  busy?: boolean;
  onCreate: (pin: string, passcodeType: AppLockPasscodeType) => void | Promise<void>;
  onCancel?: () => void;
};

type ChangeProps = {
  mode: 'change';
  busy?: boolean;
  onChange: (current: string, next: string, passcodeType: AppLockPasscodeType) => void | Promise<void>;
  onCancel?: () => void;
};

type Props = CreateProps | ChangeProps;

export function PinSetup(props: Props) {
  const { mode, busy = false } = props;
  const onCancel = props.onCancel;

  const [step, setStep] = useState<Step>(mode === 'change' ? 'current' : 'pin');
  const [draft, setDraft] = useState('');
  const [current, setCurrent] = useState('');
  const [error, setError] = useState('');
  const [resetToken, setResetToken] = useState(0);
  const [passcodeType, setPasscodeType] = useState<AppLockPasscodeType>(loadAppLockPasscodeType());
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);

  const fail = (message: string) => {
    setError(message);
    setResetToken((t) => t + 1);
    if (step === 'confirm') {
      setStep('pin');
      setDraft('');
    }
  };

  const handleComplete = async (pin: string) => {
    setError('');
    if (step === 'current') {
      setCurrent(pin);
      setStep('pin');
      setResetToken((t) => t + 1);
      return;
    }

    if (step === 'pin') {
      setDraft(pin);
      setStep('confirm');
      setResetToken((t) => t + 1);
      return;
    }

    if (pin !== draft) {
      fail('Passcodes do not match');
      return;
    }

    try {
      if (mode === 'create') {
        await props.onCreate(pin, passcodeType);
      } else {
        await props.onChange(current, pin, passcodeType);
      }
      setDraft('');
      setCurrent('');
      setStep(mode === 'change' ? 'current' : 'pin');
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Failed');
      setCurrent('');
      setStep(mode === 'change' ? 'current' : 'pin');
    }
  };

  const title =
    step === 'current'
      ? 'Enter current passcode'
      : step === 'pin'
        ? 'Create a passcode'
        : 'Confirm passcode';

  const subtitle =
    step === 'current'
      ? 'Enter your current code'
      : step === 'pin'
        ? "You'll enter this to open the app. It never leaves your device."
        : 'Enter it once more to make sure it matches.';

  const activeMode = step === 'current' ? loadAppLockPasscodeType() : passcodeType;
  const canPickType = step === 'pin';

  return (
    <div className="pin-setup">
      <PinPad
        mode={activeMode}
        creating={step !== 'current'}
        title={title}
        subtitle={subtitle}
        error={error}
        disabled={busy}
        resetToken={resetToken}
        onComplete={(pin) => void handleComplete(pin)}
        onPinChange={() => setError('')}
      />

      {canPickType && (
        <button
          type="button"
          className="pin-type-picker-btn"
          disabled={busy}
          onClick={() => setTypeSheetOpen(true)}
        >
          {passcodeTypeLabel(passcodeType)}
        </button>
      )}

      <PasscodeTypeSheet
        open={typeSheetOpen}
        value={passcodeType}
        onClose={() => setTypeSheetOpen(false)}
        onSelect={(type) => {
          setPasscodeType(type);
          setResetToken((t) => t + 1);
          setError('');
          setDraft('');
        }}
      />

      {onCancel && (
        <button type="button" className="btn-ghost pin-setup-cancel" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}

export function PinDisableButton({
  busy,
  onDisable,
  triggerClassName,
  triggerLabel = 'Turn off PIN',
  startOpen = false,
}: {
  busy?: boolean;
  onDisable: (pin: string) => void | Promise<void>;
  triggerClassName?: string;
  triggerLabel?: string;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [error, setError] = useState('');
  const [resetToken, setResetToken] = useState(0);

  if (!open) {
    return (
      <button type="button" className={triggerClassName ?? 'btn-secondary'} style={{ width: '100%' }} onClick={() => setOpen(true)}>
        {triggerLabel}
      </button>
    );
  }

  return (
    <div className="pin-setup">
      <PinPad
        title="Enter passcode to turn off"
        error={error}
        disabled={busy}
        resetToken={resetToken}
        onComplete={async (pin) => {
          setError('');
          try {
            await onDisable(pin);
            setOpen(false);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Wrong passcode');
            setResetToken((t) => t + 1);
          }
        }}
        onPinChange={() => setError('')}
      />
      <button type="button" className="btn-ghost pin-setup-cancel" disabled={busy} onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}
