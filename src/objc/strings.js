export function escapedString(string) {
  return string.replace(/"/g, '\\"');
}

export function multilineString(context, string) {
  context.printOnNewline('return [NSString stringWithFormat:');
  const lines = string.split('\n');
  context.withIndent(() => {
    lines.forEach((line, index) => {
      const isFirstLine = index == 0;
      const isLastLine = index != lines.length - 1;
      context.printOnNewline((isFirstLine ? '@' : '') + `"${escapedString(line)}"` + (isLastLine ? '' : ''));
    });
  });
  context.printOnNewline('];');
}
