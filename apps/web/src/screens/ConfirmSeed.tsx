import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockIcon } from '../components/Icons';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { PhoneShell } from '../components/PhoneShell';
import { useApp } from '../store/AppContext';
import { useDeviceLayout } from '../hooks/useDeviceLayout';
import { randomWordPositions, shuffledWordBank } from '../lib/seed-verify';

function ConfirmSeedBody({ words }: { words: string[] }) {
  const navigate = useNavigate();
  const layout = useDeviceLayout();
  const [positions] = useState(() => randomWordPositions(words.length));
  const [bank, setBank] = useState(() => shuffledWordBank(words));
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [dragWord, setDragWord] = useState<string | null>(null);
  const [wrong, setWrong] = useState(false);

  const filledCount = useMemo(() => Object.keys(assignments).length, [assignments]);
  const allFilled = filledCount === positions.length;

  const assignWord = (position: number, word: string) => {
    setAssignments((prev) => {
      const next = { ...prev };
      const existingSlot = Object.entries(next).find(([, w]) => w === word)?.[0];
      if (existingSlot !== undefined) {
        delete next[Number(existingSlot)];
      }
      const replaced = next[position];
      if (replaced && replaced !== word) {
        setBank((b) => (b.includes(replaced) ? b : [...b, replaced]));
      }
      next[position] = word;
      return next;
    });
    setBank((prev) => prev.filter((w) => w !== word));
    setDragWord(null);
  };

  const clearSlot = (position: number) => {
    const word = assignments[position];
    if (!word) return;
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[position];
      return next;
    });
    setBank((prev) => (prev.includes(word) ? prev : [...prev, word]));
  };

  const submit = () => {
    const ok = positions.every((pos) => assignments[pos] === words[pos]);
    if (!ok) {
      setWrong(true);
      setAssignments({});
      setBank(shuffledWordBank(words));
      window.setTimeout(() => setWrong(false), 700);
      return;
    }
    navigate('/onboarding/proof');
  };

  return (
    <>
      <h2 className={layout === 'computer' ? 'auth-title' : 'title'}>Confirm your phrase</h2>
      <p className={layout === 'computer' ? 'auth-subtitle' : 'subtitle'}>
        Drag each word from the list into the matching numbered slot.
      </p>

      <div className={`seed-drag-slots${wrong ? ' seed-drag-slots--wrong' : ''}`}>
        {positions.map((pos) => (
          <div
            key={pos}
            className={`seed-drag-slot${assignments[pos] ? ' seed-drag-slot--filled' : ''}${dragWord ? ' seed-drag-slot--active' : ''}`}
            onPointerUp={() => {
              if (dragWord) assignWord(pos, dragWord);
            }}
          >
            <span className="seed-drag-slot-num">#{String(pos + 1).padStart(2, '0')}</span>
            <button
              type="button"
              className="seed-drag-slot-word"
              onClick={() => clearSlot(pos)}
              disabled={!assignments[pos]}
            >
              {assignments[pos] ?? 'Drop word here'}
            </button>
          </div>
        ))}
      </div>

      <div className="label-caps" style={{ marginTop: 24, marginBottom: 8 }}>
        Word bank
      </div>
      <div className="seed-drag-bank">
        {bank.map((word) => (
          <button
            key={word}
            type="button"
            className={`seed-drag-chip${dragWord === word ? ' seed-drag-chip--dragging' : ''}`}
            onPointerDown={() => setDragWord(word)}
            onPointerUp={() => {
              if (dragWord === word) setDragWord(null);
            }}
            onClick={() => setDragWord((prev) => (prev === word ? null : word))}
          >
            {word}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="btn-primary"
        style={{ marginTop: 24, width: '100%' }}
        disabled={!allFilled}
        onClick={submit}
      >
        Continue
      </button>

      <div className="lock-footer" style={{ marginTop: 16 }}>
        <LockIcon size={11} color="#5F5F5D" />
        Tap a word, then tap a slot — or drag and drop.
      </div>
    </>
  );
}

export function ConfirmSeedScreen() {
  const layout = useDeviceLayout();
  const { identity } = useApp();
  const words = identity?.mnemonic?.split(' ') ?? [];

  if (!words.length) return null;

  const wrapped = (
    <OnboardingLayout step="STEP 3 / 4" backTo="/onboarding/seed">
      <ConfirmSeedBody words={words} />
    </OnboardingLayout>
  );

  if (layout === 'computer') return wrapped;
  return <PhoneShell>{wrapped}</PhoneShell>;
}
