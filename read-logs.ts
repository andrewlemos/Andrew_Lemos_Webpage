import fs from 'fs';
import path from 'path';

const logPath = path.join(process.cwd(), 'server.log');
if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf-8');
  const lines = content.trim().split('\n');
  console.log(`=== Last 100 log entries from server.log ===`);
  lines.slice(-100).forEach(l => console.log(l));
} else {
  console.log("No server.log file found!");
}
