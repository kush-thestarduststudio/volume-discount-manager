import fs from 'fs';
import readline from 'readline';

const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/Admin/.gemini/antigravity/brain/3c33c5ff-2ad0-4add-a2b9-136d94828ca9/.system_generated/logs/transcript_full.jsonl')
});

rl.on('line', (line) => {
  if (line.includes('"step_index": 10278') || line.includes('"step_index":10278')) {
    const obj = JSON.parse(line);
    console.log('Thinking:');
    console.log(obj.thinking?.slice(0, 3000));
  }
});
