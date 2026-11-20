import fs from 'fs';

const lines = fs.readFileSync('C:/Users/Admin/.gemini/antigravity/brain/3c33c5ff-2ad0-4add-a2b9-136d94828ca9/.system_generated/logs/transcript.jsonl', 'utf8').split('\n');
for (const line of lines) {
  if (line.includes('"step_index":7527') || line.includes('"step_index":7528') || line.includes('"step_index":7529')) {
    console.log(line.slice(0, 500));
  }
}
