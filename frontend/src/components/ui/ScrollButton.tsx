interface Props {
  onClick: () => void;
}

export function ScrollButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-200 shadow-lg flex items-center justify-center transition-colors light:bg-slate-300 light:hover:bg-slate-400 light:text-slate-700"
      aria-label="Scroll to bottom"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}
