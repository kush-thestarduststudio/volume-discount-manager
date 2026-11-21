import fs from 'fs';

const data = fs.readFileSync('C:/Users/Admin/.gemini/antigravity/brain/3c33c5ff-2ad0-4add-a2b9-136d94828ca9/.system_generated/logs/transcript.jsonl', 'utf8');
const lines = data.trim().split('\n');
for (let i = 0; i < lines.length; i++) {
  try {
    const obj = JSON.parse(lines[i]);
    if (obj.type === 'USER_INPUT') {
      console.log('User input at step:', obj.step_index, obj.content?.slice(0, 100));
    }
  } catch {}
}
