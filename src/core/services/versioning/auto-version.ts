export function shouldCreateVersion(
  lastVersionTimestamp: string | null,
  lastVersionText: string,
  currentText: string,
): boolean {
  // At least 5 minutes since last version
  if (lastVersionTimestamp) {
    const elapsed = Date.now() - new Date(lastVersionTimestamp).getTime();
    if (elapsed < 5 * 60 * 1000) return false;
  }

  // At least 50 characters difference
  const diff = Math.abs(currentText.length - lastVersionText.length);
  if (diff < 50) return false;

  return true;
}
