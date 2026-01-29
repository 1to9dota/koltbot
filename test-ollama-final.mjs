import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { streamSimple } from "@mariozechner/pi-ai";
import { discoverAuthStorage, discoverModels } from "@mariozechner/pi-coding-agent";
import { ensureMoltbotModelsJson } from "./dist/agents/models-config.js";

async function testOllamaIntegration() {
  const agentDir = mkdtempSync(join(tmpdir(), "koltbot-test-"));
  console.log("🧪 Testing Ollama integration (with patch)...\n");

  try {
    // 1. 生成 models.json
    console.log("Step 1: Generating models.json...");
    await ensureMoltbotModelsJson({}, agentDir);
    console.log("✅ models.json generated\n");

    // 2. 设置 authStorage（不需要真实 API key）
    console.log("Step 2: Setting up authStorage...");
    const authStorage = discoverAuthStorage(agentDir);
    authStorage.setRuntimeApiKey("ollama", "ollama");
    console.log("✅ AuthStorage configured\n");

    // 3. 发现模型
    console.log("Step 3: Discovering models...");
    const modelRegistry = discoverModels(authStorage, agentDir);
    const allModels = modelRegistry.getAll();
    const ollamaModels = allModels.filter(m => m.provider === "ollama");

    if (ollamaModels.length === 0) {
      console.log("❌ No Ollama models found");
      return;
    }

    console.log("✅ Ollama models found:", ollamaModels.length);
    ollamaModels.forEach(m => {
      console.log(`   - ${m.provider}/${m.id}`);
    });
    console.log();

    // 4. 发送测试请求
    console.log("Step 4: Sending test request to Ollama...");
    const model = ollamaModels[0];
    console.log("   Using model:", model.provider + "/" + model.id);
    console.log("   Base URL:", model.baseUrl);
    console.log();

    const messages = [
      { role: "user", content: "你好！请用一句话介绍你自己。" }
    ];

    console.log("💬 Request:");
    console.log("   User: 你好！请用一句话介绍你自己。\n");
    console.log("💬 Response:");
    process.stdout.write("   Assistant: ");

    let responseText = "";
    let chunkCount = 0;

    for await (const chunk of streamSimple(model, { messages })) {
      if (chunk.type === "text_delta") {
        process.stdout.write(chunk.delta);
        responseText += chunk.delta;
        chunkCount++;
      }
    }

    console.log("\n");
    console.log("✅ SUCCESS: Ollama integration fully working!");
    console.log("   Response length:", responseText.length, "characters");
    console.log("   Chunks received:", chunkCount);

  } catch (error) {
    console.log("\n❌ FAILED");
    console.error("Error:", error.message);
    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
  }
}

testOllamaIntegration();
