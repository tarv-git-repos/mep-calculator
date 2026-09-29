const fs = require("fs");
const lines = fs.readFileSync("C:/Users/ADMIN/.gemini/antigravity/brain/7386c49d-cdf5-465a-9b82-e8c3b60fdaed/.system_generated/logs/transcript.jsonl", "utf8").split("\n");
for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.type === "USER_INPUT") {
      console.log("Step", obj.step_index, obj.content.replace(/<[^>]+>/g, "").trim().slice(0, 100));
    }




  } catch(e) {}
}
