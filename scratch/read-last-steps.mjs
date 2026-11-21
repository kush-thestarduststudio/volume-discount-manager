import fs from 'fs';

const data = fs.readFileSync('C:/Users/Admin/.gemini/antigravity/brain/3c33c5ff-2ad0-4add-a2b9-136d94828ca9/.system_generated/logs/transcript.jsonl', 'utf8');
const lines = data.trim().split('\n');
console.log('Total steps:', lines.length);
for (let i = Math.max(0, lines.length - 15); i < lines.length; i++) {
  try {
    const obj = JSON.parse(lines[i]);
    console.log(i, 'step:', obj.step_index, 'type:', obj.type, 'truncated:', obj.truncated_fields);
    if (obj.content) console.log('  content:', obj.content.slice(0, 100));
  } catch {}
}
