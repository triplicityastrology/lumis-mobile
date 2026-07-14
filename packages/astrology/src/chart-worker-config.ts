export function allowsFixtureFallbackForEnvironment(environment?: string | null): boolean {
  const normalizedEnvironment = (environment ?? "production").toLowerCase();

  return ["dev", "development", "local", "staging", "test"].includes(normalizedEnvironment);
}
