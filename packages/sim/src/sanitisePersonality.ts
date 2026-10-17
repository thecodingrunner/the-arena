export function sanitisePersonality(prompt: string): string {
  // strip closing tags
  const regex = /<\/[a-zA-Z_][a-zA-Z0-9_-]*>?/g;
  let previousPrompt = prompt;
  let strippedPrompt = prompt.replace(regex, "");
  while (previousPrompt.length !== strippedPrompt.length) {
    previousPrompt = strippedPrompt;
    strippedPrompt = strippedPrompt.replace(regex, "");
  }

  let finalPrompt = strippedPrompt;
  if (strippedPrompt.length > 280) {
    finalPrompt = strippedPrompt.slice(0, 280);
  }

  return finalPrompt;
}
