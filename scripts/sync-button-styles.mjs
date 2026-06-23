import fs from "fs";
import path from "path";

const root = path.resolve(".");

const replacements = [
  [
    'className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"',
    "className={toolbarPrimaryButtonClassName}",
    "toolbarPrimaryButtonClassName",
  ],
  [
    'className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500 dark:bg-emerald-600"',
    "className={toolbarPrimaryButtonClassName}",
    "toolbarPrimaryButtonClassName",
  ],
  [
    'className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"',
    "className={primaryButtonClassName}",
    "primaryButtonClassName",
  ],
  [
    'className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"',
    "className={primaryButtonClassName}",
    "primaryButtonClassName",
  ],
  [
    'className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"',
    "className={primaryButtonClassName}",
    "primaryButtonClassName",
  ],
  [
    'className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"',
    "className={primaryButtonClassName}",
    "primaryButtonClassName",
  ],
  [
    'className="rounded-lg border border-emerald-700 bg-emerald-800 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60 dark:border-emerald-500 dark:bg-emerald-600"',
    "className={compactPrimaryButtonClassName}",
    "compactPrimaryButtonClassName",
  ],
  [
    'className="rounded-lg border border-emerald-700 bg-emerald-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"',
    "className={compactPrimaryButtonClassName}",
    "compactPrimaryButtonClassName",
  ],
  [
    'className="rounded-xl border border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700/70 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/15"',
    "className={warningButtonClassName}",
    "warningButtonClassName",
  ],
  [
    'className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"',
    "className={primaryButtonClassName}",
    "primaryButtonClassName",
  ],
  [
    'className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60 dark:border-emerald-500 dark:bg-emerald-600"',
    "className={toolbarPrimaryButtonClassName}",
    "toolbarPrimaryButtonClassName",
  ],
  [
    'className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"',
    "className={toolbarPrimaryButtonClassName}",
    "toolbarPrimaryButtonClassName",
  ],
  [
    'className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"',
    "className={dangerButtonClassName}",
    "dangerButtonClassName",
  ],
  [
    'className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 dark:bg-red-500 dark:text-white dark:hover:bg-red-400"',
    "className={dangerButtonClassName}",
    "dangerButtonClassName",
  ],
  [
    'className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 dark:bg-red-500 dark:text-white dark:hover:bg-red-400"',
    "className={dangerButtonClassName}",
    "dangerButtonClassName",
  ],
  [
    'className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100"',
    "className={cancelButtonClassName}",
    "cancelButtonClassName",
  ],
  [
    'className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-100"',
    "className={cancelButtonClassName}",
    "cancelButtonClassName",
  ],
  [
    'className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"',
    "className={tableActionButtonClassName}",
    "tableActionButtonClassName",
  ],
  [
    'className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"',
    "className={tableActionDangerButtonClassName}",
    "tableActionDangerButtonClassName",
  ],
  [
    'className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 bg-emerald-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"',
    "className={toolbarPrimaryButtonClassName}",
    "toolbarPrimaryButtonClassName",
  ],
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next" || ent.name === "scripts") continue;
    const fullPath = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(fullPath, files);
    else if (ent.name.endsWith(".tsx")) files.push(fullPath);
  }
  return files;
}

function addImports(content, imports) {
  if (imports.length === 0) return content;

  const buttonStylesImport = /import \{([^}]+)\} from "@\/lib\/button-styles";/;
  if (buttonStylesImport.test(content)) {
    return content.replace(buttonStylesImport, (_, inner) => {
      const existing = inner.split(",").map((s) => s.trim()).filter(Boolean);
      const merged = [...new Set([...existing, ...imports])].sort();
      return `import { ${merged.join(", ")} } from "@/lib/button-styles";`;
    });
  }

  const formControlsImport = /import \{([^}]+)\} from "@\/components\/ui\/form-controls";/;
  if (formControlsImport.test(content)) {
    return content.replace(formControlsImport, (_, inner) => {
      const existing = inner.split(",").map((s) => s.trim()).filter(Boolean);
      const merged = [...new Set([...existing, ...imports])].sort();
      return `import { ${merged.join(", ")} } from "@/components/ui/form-controls";`;
    });
  }

  const importLine = `import { ${imports.join(", ")} } from "@/lib/button-styles";`;
  if (content.startsWith('"use client"')) {
    const insertAt = content.indexOf("\n") + 1;
    return `${content.slice(0, insertAt)}${importLine}\n${content.slice(insertAt)}`;
  }

  return `${importLine}\n${content}`;
}

let changed = 0;

for (const file of walk(root)) {
  if (file.includes(`${path.sep}components${path.sep}ui${path.sep}`)) continue;

  let content = fs.readFileSync(file, "utf8");
  const original = content;
  const neededImports = new Set();

  for (const [from, to, importName] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      neededImports.add(importName);
    }
  }

  if (content === original) continue;

  content = addImports(content, [...neededImports]);
  fs.writeFileSync(file, content);
  changed += 1;
  console.log(path.relative(root, file));
}

console.log(`Changed files: ${changed}`);
