import fs from "fs";
import path from "path";

const target = "IMG_20230520_122543_345-1.jpg";

function checkFile(dir: string) {
  const p = path.join(process.cwd(), dir, target);
  const exists = fs.existsSync(p);
  console.log(`Checking ${p}: ${exists ? "EXISTS" : "DOES NOT EXIST"}`);
  if (exists) {
    const stats = fs.statSync(p);
    console.log(`  Size: ${stats.size} bytes`);
  }
}

console.log("=== Checking file presence ===");
checkFile("arquivos");
checkFile("public/arquivos");
checkFile("dist/arquivos");

// Let's also list some files in public/arquivos to see what names they have
const pubDir = path.join(process.cwd(), "public/arquivos");
if (fs.existsSync(pubDir)) {
  const files = fs.readdirSync(pubDir);
  console.log(`\nTotal files in public/arquivos: ${files.length}`);
  console.log("Sample files:", files.slice(0, 10));
  const normalizedTarget = target.toLowerCase().normalize("NFC");
  const match = files.find(f => f.toLowerCase().normalize("NFC") === normalizedTarget);
  console.log(`Normalized exact match for ${target} in public/arquivos:`, match ? `FOUND: ${match}` : "NOT FOUND");
}
