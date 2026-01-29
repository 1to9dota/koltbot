---
summary: "Run Moltbot with Ollama (local LLM runtime)"
read_when:
  - You want to run Moltbot with local models via Ollama
  - You need Ollama setup and configuration guidance
---
# Ollama

Ollama is a local LLM runtime that makes it easy to run open-source models on your machine. Moltbot integrates with Ollama's OpenAI-compatible API and can **auto-discover tool-capable models** when you opt in with `OLLAMA_API_KEY` (or an auth profile) and do not define an explicit `models.providers.ollama` entry.

## Quick start

1) Install Ollama: https://ollama.ai

2) Pull a model:

```bash
ollama pull llama3.3
# or
ollama pull qwen2.5-coder:32b
# or
ollama pull deepseek-r1:32b
```

3) Enable Ollama for Moltbot (any value works; Ollama doesn't require a real key):

```bash
# Set environment variable
export OLLAMA_API_KEY="ollama-local"

# Or configure in your config file
moltbot config set models.providers.ollama.apiKey "ollama-local"
```

4) Use Ollama models:

```json5
{
  agents: {
    defaults: {
      model: { primary: "ollama/llama3.3" }
    }
  }
}
```

## Model discovery (implicit provider)

When you set `OLLAMA_API_KEY` (or an auth profile) and **do not** define `models.providers.ollama`, Moltbot discovers models from the local Ollama instance at `http://127.0.0.1:11434`:

- Queries `/api/tags` and `/api/show`
- Keeps only models that report `tools` capability
- Marks `reasoning` when the model reports `thinking`
- Reads `contextWindow` from `model_info["<arch>.context_length"]` when available
- Sets `maxTokens` to 10× the context window
- Sets all costs to `0`

This avoids manual model entries while keeping the catalog aligned with Ollama's capabilities.

To see what models are available:

```bash
ollama list
moltbot models list
```

To add a new model, simply pull it with Ollama:

```bash
ollama pull mistral
```

The new model will be automatically discovered and available to use.

If you set `models.providers.ollama` explicitly, auto-discovery is skipped and you must define models manually (see below).

## Configuration

### Basic setup (implicit discovery)

The simplest way to enable Ollama is via environment variable:

```bash
export OLLAMA_API_KEY="ollama-local"
```

### Explicit setup (manual models)

Use explicit config when:
- Ollama runs on another host/port.
- You want to force specific context windows or model lists.
- You want to include models that do not report tool support.

```json5
{
  models: {
    providers: {
      ollama: {
        // Use a host that includes /v1 for OpenAI-compatible APIs
        baseUrl: "http://ollama-host:11434/v1",
        apiKey: "ollama-local",
        api: "openai-completions",
        models: [
          {
            id: "llama3.3",
            name: "Llama 3.3",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 8192,
            maxTokens: 8192 * 10
          }
        ]
      }
    }
  }
}
```

If `OLLAMA_API_KEY` is set, you can omit `apiKey` in the provider entry and Moltbot will fill it for availability checks.

### Custom base URL (explicit config)

If Ollama is running on a different host or port (explicit config disables auto-discovery, so define models manually):

```json5
{
  models: {
    providers: {
      ollama: {
        apiKey: "ollama-local",
        baseUrl: "http://ollama-host:11434/v1"
      }
    }
  }
}
```

### Model selection

Once configured, all your Ollama models are available:

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "ollama/llama3.3",
        fallback: ["ollama/qwen2.5-coder:32b"]
      }
    }
  }
}
```

## Advanced

### Reasoning models

Moltbot marks models as reasoning-capable when Ollama reports `thinking` in `/api/show`:

```bash
ollama pull deepseek-r1:32b
```

### Model Costs

Ollama is free and runs locally, so all model costs are set to $0.

### Context windows

For auto-discovered models, Moltbot uses the context window reported by Ollama when available, otherwise it defaults to `8192`. You can override `contextWindow` and `maxTokens` in explicit provider config.

### Tool calling behavior

**Important:** Local Ollama models are automatically configured to run in **LLM-only mode** (tools disabled) when using the `--local` flag with `moltbot agent`. This prevents tool calling loops that can occur with smaller local models.

**Why tools are disabled:**
- Many Ollama models (especially smaller ones like 7B-14B params) struggle with tool use
- They tend to repeatedly call tools (like `tts`) instead of responding directly
- This creates infinite loops where the model calls a tool → receives result → calls the same tool again

**What this means:**
- Ollama models work great for conversational text responses
- Built-in Moltbot tools (file operations, web search, etc.) are not available
- This is a trade-off for stable, predictable local LLM conversations

**Example:**

```bash
# Works great - pure conversation
pnpm moltbot agent --local --message "介绍一下你自己" --to "+8615555550123"
# Response: 你好！我是通义千问，是由阿里云研发的超大规模语言模型...

# Tools are automatically disabled for Ollama
# No TTS calls, no file operations, just clean text responses
```

**Technical details:**
When `providerOverride === "ollama"`, Moltbot automatically sets `disableTools: true` in `runEmbeddedPiAgent` to ensure stable operation with local models.

### Auth profile setup

For `--local` mode, you need to configure an auth profile:

```bash
# Create auth profile directory
mkdir -p ~/.clawdbot/agents/main/agent

# Create auth profile
cat > ~/.clawdbot/agents/main/agent/auth-profiles.json << 'EOF'
{
  "version": 1,
  "profiles": {
    "ollama-local": {
      "type": "api_key",
      "provider": "ollama",
      "key": "ollama"
    }
  }
}
EOF
```

This is a one-time setup. The API key "ollama" is just a placeholder since Ollama doesn't require real authentication.

### Using with CLI

Complete workflow for using Ollama with Moltbot CLI:

```bash
# 1. Make sure Ollama is running with a model loaded
ollama pull qwen2.5:7b
ollama list  # Verify model is available

# 2. Set default model
pnpm moltbot models set ollama/qwen2.5:7b

# 3. Start conversations
pnpm moltbot agent --local --message "你好" --to "+8615555550123"
```

**Session management:**
- Each `--to` number creates a separate conversation session
- Sessions accumulate context until the model's context window is full
- When context is full (`<no_reply>` appears), clear sessions:

```bash
rm -rf ~/.moltbot/agents/main/sessions/*.jsonl
```

## Troubleshooting

### Ollama not detected

Make sure Ollama is running and that you set `OLLAMA_API_KEY` (or an auth profile), and that you did **not** define an explicit `models.providers.ollama` entry:

```bash
ollama serve
```

And that the API is accessible:

```bash
curl http://localhost:11434/api/tags
```

### No models available

Moltbot only auto-discovers models that report tool support. If your model isn't listed, either:
- Pull a tool-capable model, or
- Define the model explicitly in `models.providers.ollama`.

To add models:

```bash
ollama list  # See what's installed
ollama pull llama3.3  # Pull a model
```

### Connection refused

Check that Ollama is running on the correct port:

```bash
# Check if Ollama is running
ps aux | grep ollama

# Or restart Ollama
ollama serve
```

### Model returns `<no_reply>`

This happens when the context window is full. Clear the session and start fresh:

```bash
rm -rf ~/.moltbot/agents/main/sessions/*.jsonl
```

Then retry your message. Each model has a limited context window (e.g., qwen2.5:7b has 4096 tokens), and long conversations will eventually fill it.

### Node version error

Moltbot requires Node 22+. If you see version errors:

```bash
# Install Node 22
brew install node@22

# Add to PATH (add to ~/.zshrc for persistence)
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

# Verify
node --version  # Should show v22.x.x
```

### API key errors

If you see "No API key found for provider ollama", set up an auth profile:

```bash
mkdir -p ~/.clawdbot/agents/main/agent
cat > ~/.clawdbot/agents/main/agent/auth-profiles.json << 'EOF'
{
  "version": 1,
  "profiles": {
    "ollama-local": {
      "type": "api_key",
      "provider": "ollama",
      "key": "ollama"
    }
  }
}
EOF
```

## See Also

- [Model Providers](/concepts/model-providers) - Overview of all providers
- [Model Selection](/concepts/models) - How to choose models
- [Configuration](/gateway/configuration) - Full config reference
