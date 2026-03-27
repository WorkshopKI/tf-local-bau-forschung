export function HomePage(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <h1 className="text-5xl font-bold text-[var(--tf-text)] mb-4">
        TeamFlow
      </h1>
      <p className="text-lg text-[var(--tf-text-secondary)] max-w-md">
        Lokales Aufgabenmanagement mit AI-Integration.
        Serverlos, direkt im Browser.
      </p>
    </div>
  );
}
