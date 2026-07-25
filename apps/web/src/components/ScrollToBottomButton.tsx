export function ScrollToBottomButton({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  if (!visible) return null;

  return (
    <button
      type="button"
      className="chat-scroll-down"
      aria-label="Scroll to latest messages"
      onClick={onClick}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14M5 12l7 7 7-7" />
      </svg>
    </button>
  );
}
