import fs from "fs";
import path from "path";

const root = path.resolve(".");

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next" || ent.name === "scripts") continue;
    const fullPath = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(fullPath, files);
    else if (ent.name.endsWith(".tsx")) files.push(fullPath);
  }
  return files;
}

function addImports(content, formImports, actionImports) {
  let next = content;

  if (formImports.length > 0) {
    const formImport = /import \{([^}]+)\} from "@\/components\/ui\/form-controls";/;
    if (formImport.test(next)) {
      next = next.replace(formImport, (_, inner) => {
        const existing = inner.split(",").map((s) => s.trim()).filter(Boolean);
        const merged = [...new Set([...existing, ...formImports])].sort();
        return `import { ${merged.join(", ")} } from "@/components/ui/form-controls";`;
      });
    }
  }

  if (actionImports.length > 0) {
    const actionImport = /import \{([^}]+)\} from "@\/components\/ui\/action-buttons";/;
    if (actionImport.test(next)) {
      next = next.replace(actionImport, (_, inner) => {
        const existing = inner.split(",").map((s) => s.trim()).filter(Boolean);
        const merged = [...new Set([...existing, ...actionImports])].sort();
        return `import { ${merged.join(", ")} } from "@/components/ui/action-buttons";`;
      });
    } else {
      const line = `import { ${actionImports.join(", ")} } from "@/components/ui/action-buttons";`;
      if (next.startsWith('"use client"')) {
        const insertAt = next.indexOf("\n") + 1;
        next = `${next.slice(0, insertAt)}${line}\n${next.slice(insertAt)}`;
      } else {
        next = `${line}\n${next}`;
      }
    }
  }

  return next;
}

function cleanupImports(content) {
  let next = content;

  for (const token of [
    "cancelButtonClassName",
    "dangerButtonClassName",
    "warningButtonClassName",
    "toolbarPrimaryButtonClassName",
    "primaryButtonClassName",
    "tableActionButtonClassName",
    "tableActionDangerButtonClassName",
  ]) {
    if (!next.includes(token)) {
      next = next.replace(new RegExp(`,?\\s*${token}`, "g"), "");
      next = next.replace(new RegExp(`${token},?\\s*`, "g"), "");
    }
  }

  next = next.replace(/import \{\s*,/g, "import {");
  next = next.replace(/,\s*\}/g, " }");
  next = next.replace(/import \{\s*\} from "@\/lib\/button-styles";\n?/g, "");
  next = next.replace(/import \{\s*\} from "lucide-react";\n?/g, "");

  return next;
}

let changed = 0;

for (const file of walk(root)) {
  if (file.includes(`${path.sep}components${path.sep}ui${path.sep}`)) continue;
  if (file.endsWith("form-controls.tsx")) continue;

  let content = fs.readFileSync(file, "utf8");
  const original = content;
  const formImports = new Set();
  const actionImports = new Set();

  content = content.replace(
    /<button\s+type="button"([\s\S]*?)className=\{cancelButtonClassName\}([\s\S]*?)>\s*(Cancel|Close)\s*<\/button>/g,
    (_match, before, after, label) => {
      formImports.add("CancelButton");
      return `<CancelButton type="button"${before}${after}>${label}</CancelButton>`;
    }
  );

  content = content.replace(
    /<button\s+type="button"([\s\S]*?)className=\{dangerButtonClassName\}([\s\S]*?)>([\s\S]*?)<\/button>/g,
    (_match, before, after, inner) => {
      formImports.add("DangerButton");
      return `<DangerButton type="button"${before}${after}>${inner.trim()}</DangerButton>`;
    }
  );

  content = content.replace(
    /<button\s+type="button"([\s\S]*?)className=\{warningButtonClassName\}([\s\S]*?)>([\s\S]*?)<\/button>/g,
    (_match, before, after, inner) => {
      formImports.add("WarningButton");
      return `<WarningButton type="button"${before}${after}>${inner.trim()}</WarningButton>`;
    }
  );

  content = content.replace(
    /<button\s+type="button"([\s\S]*?)className=\{toolbarPrimaryButtonClassName\}([\s\S]*?)>\s*<Plus size=\{15\} \/>\s*([\s\S]*?)<\/button>/g,
    (_match, before, after, label) => {
      actionImports.add("AddNewButton");
      return `<AddNewButton type="button"${before}${after}>${label.trim()}</AddNewButton>`;
    }
  );

  content = content.replace(
    /<button\s+type="button"([\s\S]*?)className=\{toolbarPrimaryButtonClassName\}([\s\S]*?)>([\s\S]*?)<\/button>/g,
    (_match, before, after, inner) => {
      if (!inner.includes("Plus")) return _match;
      actionImports.add("AddNewButton");
      const label = inner.replace(/<Plus size=\{15\} \/>\s*/, "").trim();
      return `<AddNewButton type="button"${before}${after}>${label}</AddNewButton>`;
    }
  );

  content = content.replace(
    /<button\s+type="button"([\s\S]*?)className=\{primaryButtonClassName\}([\s\S]*?)>([\s\S]*?)<\/button>/g,
    (_match, before, after, inner) => {
      formImports.add("PrimaryButton");
      return `<PrimaryButton type="button"${before}${after}>${inner.trim()}</PrimaryButton>`;
    }
  );

  content = content.replace(
    /<Link\s+href=\{([^}]+)\}\s+className=\{tableActionButtonClassName\}\s*>\s*([\s\S]*?)<\/Link>/g,
    (_match, href, inner) => {
      actionImports.add("TableActionLink");
      return `<TableActionLink href={${href}}>${inner.trim()}</TableActionLink>`;
    }
  );

  content = content.replace(
    /<button\s+type="button"([\s\S]*?)className=\{tableActionDangerButtonClassName\}([\s\S]*?)>([\s\S]*?)<\/button>/g,
    (_match, before, after, inner) => {
      actionImports.add("TableActionButton");
      return `<TableActionButton variant="danger" type="button"${before}${after}>${inner.trim()}</TableActionButton>`;
    }
  );

  content = content.replace(
    /<button\s+type="button"([\s\S]*?)className=\{tableActionButtonClassName\}([\s\S]*?)>([\s\S]*?)<\/button>/g,
    (_match, before, after, inner) => {
      actionImports.add("TableActionButton");
      return `<TableActionButton type="button"${before}${after}>${inner.trim()}</TableActionButton>`;
    }
  );

  if (content === original) continue;

  content = addImports(content, [...formImports], [...actionImports]);
  content = cleanupImports(content);

  fs.writeFileSync(file, content);
  changed += 1;
  console.log(path.relative(root, file));
}

console.log(`Changed files: ${changed}`);
