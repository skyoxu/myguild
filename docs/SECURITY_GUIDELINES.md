# Security Guidelines

This document outlines security best practices for this project to prevent API key exposure and other security issues.

## API Key Management

### Never Commit API Keys

- **NEVER** hardcode API keys directly in source code
- **ALWAYS** use environment variables for API keys
- Use the `.env.template` file as a reference for required environment variables

### Environment Variables

All API keys should be stored in environment variables:

```bash
# Required for Claude Code and MCP servers
OPENAI_API_KEY=your_actual_openai_key
ANTHROPIC_API_KEY=your_actual_anthropic_key

# Optional API keys
GOOGLE_API_KEY=your_google_key
PERPLEXITY_API_KEY=your_perplexity_key
# ... etc
```

### File Patterns to Exclude

The following patterns are already in `.gitignore` to prevent accidental commits:

```gitignore
# Environment files
.env
.env.local
.env.*.local

# Security files
*.key
*.pem
*.p12
.claude/settings.local.json
.sentryclirc
```

## Code Patterns

### ✅ Correct Pattern

```python
import os

# Check if API key is available from environment
if not os.environ.get("OPENAI_API_KEY"):
    raise ValueError("OPENAI_API_KEY environment variable is required")

# Use the key
api_key = os.environ["OPENAI_API_KEY"]
```

```javascript
// In configuration files (.mcp.json, etc.)
{
  "env": {
    "OPENAI_API_KEY": "${OPENAI_API_KEY}"
  }
}
```

### ❌ Never Do This

```python
# NEVER hardcode API keys
os.environ["OPENAI_API_KEY"] = "sk-proj-actual-key-here"
api_key = "sk-ant-api03-actual-key-here"
```

```javascript
// NEVER in config files
{
  "env": {
    "OPENAI_API_KEY": "sk-proj-actual-key-here"
  }
}
```

## CI/CD Security

### GitHub Actions

- Use GitHub Secrets for API keys in workflows
- Never print or log API keys
- Use secret scanning and push protection

### Example workflow setup:

```yaml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Development Setup

1. Copy `.env.template` to `.env.local`
2. Fill in your actual API keys in `.env.local`
3. Never commit `.env.local`

## Emergency Response

If API keys are accidentally exposed:

1. **Immediately revoke** the exposed keys in the respective platform consoles
2. **Generate new keys** and update environment variables
3. **Remove sensitive files** from git staging if caught before commit
4. **Use git filter-repo** to clean history if already committed (destructive operation)

## Regular Security Practices

- Enable GitHub secret scanning and push protection
- Use pre-commit hooks to scan for secrets
- Regularly rotate API keys
- Monitor for unauthorized API usage
- Use principle of least privilege for API key permissions

## Tools for Security

- **TruffleHog**: For secret scanning
- **Gitleaks**: For git history scanning
- **GitHub Advanced Security**: Built-in secret scanning
- **Pre-commit hooks**: To catch issues before commit

## Questions?

If you're unsure about any security practices, ask for a security review before committing code that handles sensitive data.