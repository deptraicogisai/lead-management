import fs from "fs";
import path from "path";

const cancelBlock = `<button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>`;

const cancelComponent = `<CancelButton type="button" onClick={() => setDeleteTarget(null)} />`;

const dangerBlock = `<button
              type="button"
              onClick={handleDelete}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 dark:bg-red-500 dark:text-white dark:hover:bg-red-400"
            >
              Delete
            </button>`;

const dangerComponent = `<DangerButton type="button" onClick={handleDelete}>Delete</DangerButton>`;

const modalCancel = `<button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100"
          >
            Cancel
          </button>`;

const modalCancelComponent = `<CancelButton type="button" onClick={onClose} />`;

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "scripts"].includes(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, files);
    else if (ent.name.endsWith(".tsx")) files.push(full);
  }
  return files;
}

function ensureImports(content, names) {
  const actionImport = /import \{([^}]+)\} from "@\/components\/ui\/action-buttons";/;
  const formImport = /import \{([^}]+)\} from "@\/components\/ui\/form-controls";/;
  const formNames = names.filter((n) => ["CancelButton", "DangerButton", "WarningButton", "PrimaryButton"].includes(n));
  const actionNames = names.filter((n) => ["AddNewButton", "DeleteSelectedButton", "TableActionButton", "TableActionLink"].includes(n));

  let next = content;
  if (formNames.length && formImport.test(next)) {
    next = next.replace(formImport, (_, inner) => {
      const merged = [...new Set([...inner.split(",").map((s) => s.trim()).filter(Boolean), ...formNames])].sort();
      return `import { ${merged.join(", ")} } from "@/components/ui/form-controls";`;
    });
  } else if (formNames.length) {
    const line = `import { ${formNames.join(", ")} } from "@/components/ui/form-controls";`;
    next = next.startsWith('"use client"')
      ? next.replace("\n", `\n${line}\n`)
      : `${line}\n${next}`;
  }

  if (actionNames.length && actionImport.test(next)) {
    next = next.replace(actionImport, (_, inner) => {
      const merged = [...new Set([...inner.split(",").map((s) => s.trim()).filter(Boolean), ...actionNames])].sort();
      return `import { ${merged.join(", ")} } from "@/components/ui/action-buttons";`;
    });
  }

  return next;
}

let changed = 0;
for (const file of walk(".")) {
  if (file.includes(`${path.sep}components${path.sep}ui${path.sep}`)) continue;
  let content = fs.readFileSync(file, "utf8");
  const original = content;
  const imports = new Set();

  if (content.includes(cancelBlock)) {
    content = content.replaceAll(cancelBlock, cancelComponent);
    imports.add("CancelButton");
  }
  if (content.includes(dangerBlock)) {
    content = content.replaceAll(dangerBlock, dangerComponent);
    imports.add("DangerButton");
  }
  if (content.includes(modalCancel)) {
    content = content.replaceAll(modalCancel, modalCancelComponent);
    imports.add("CancelButton");
  }

  if (content === original) continue;
  content = ensureImports(content, [...imports]);
  fs.writeFileSync(file, content);
  changed++;
  console.log(file);
}

console.log(`Updated ${changed} files`);
