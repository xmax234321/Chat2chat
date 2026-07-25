type ToggleSwitchProps = {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  secure?: boolean;
  ariaLabel?: string;
};

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  secure = false,
  ariaLabel = 'Toggle',
}: ToggleSwitchProps) {
  const tone = secure ? 'tg-on-g' : checked ? 'tg-on' : 'tg-off';
  const classes = [
    'tg',
    `tg-${size}`,
    tone,
    checked ? 'on' : '',
    disabled ? 'tg-disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={classes}
      onClick={() => {
        if (!disabled) onChange?.(!checked);
      }}
    />
  );
}

