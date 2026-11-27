import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";

// The public surface as a committed list. A removed or renamed name here is a breaking
// change: it needs a major version. Additions are fine. Update with `pnpm test -- -u`
// and review the diff.
it("exports exactly the committed public API", async () => {
  const entry = fileURLToPath(new URL("../src/index.ts", import.meta.url));
  const config = ts.getParsedCommandLineOfConfigFile(
    fileURLToPath(new URL("../tsconfig.json", import.meta.url)),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
      },
    },
  )!;
  const program = ts.createProgram([entry], config.options);
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(entry)!;
  const module = checker.getSymbolAtLocation(source)!;

  const surface = checker.getExportsOfModule(module).map((symbol) => {
    const real = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    return `${real.flags & ts.SymbolFlags.Value ? "value" : "type "} ${symbol.name}`;
  });

  await expect(`${surface.toSorted().join("\n")}\n`).toMatchFileSnapshot("./api.snapshot.txt");
}, 120_000);
