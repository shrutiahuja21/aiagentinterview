const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'public');
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir);
}

const src = 'C:\\Users\\GURU\\.gemini\\antigravity\\brain\\eb6eb7e0-a1de-44fd-8146-76c0e5d2b443\\ai_interviewer_avatar_1774255487433.png';
const dest = path.join(targetDir, 'avatar.png');

fs.copyFileSync(src, dest);
console.log('Copied avatar to public/avatar.png');
