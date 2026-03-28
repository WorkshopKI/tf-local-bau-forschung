export function HomePage(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <h1 className="text-[28px] font-medium text-[var(--tf-text)] mb-3">
        TeamFlow
      </h1>
      <p className="text-[14px] text-[var(--tf-text-secondary)] max-w-md">
        Lokales Aufgabenmanagement mit AI-Integration.
        Serverlos, direkt im Browser.
      </p>
    </div>
  );
}
