import fs from "fs";
import path from "path";

const root = path.resolve(".");

const componentNames = [
  "DangerButton",
  "WarningButton",
  "CancelButton",
  "PrimaryButton",
  "TableActionButton",
  "AddNewButton",
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

let changed = 0;

for (const file of walk(root)) {
  let content = fs.readFileSync(file, "utf8");
  const original = content;

  for (const name of componentNames) {
    const openTag = new RegExp(`<${name}\\b`, "g");
    const closeWrong = new RegExp(`</button>`, "g");

    if (!openTag.test(content)) continue;

    const parts = content.split(new RegExp(`(<${name}\\b[\\s\\S]*?</button>)`, "g"));
    content = parts
      .map((part) => {
        if (part.startsWith(`<${name}`)) {
          return part.replace(/<\/button>\s*$/, `</${name}>`);
        }
        return part;
      })
      .join("");
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    changed += 1;
    console.log(path.relative(root, file));
  }
}

console.log(`Fixed files: ${changed}`);
