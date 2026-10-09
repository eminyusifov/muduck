export const DEFAULT_DOCUMENT = `# 🦆 Welcome to Muduck

> [!NOTE]
> **Muduck** is your dedicated macOS reader and editor designed specifically for AI-generated reports, research papers, and technical Markdown.

---

## 1. Why Muduck?

AI assistants generate extensive analyses with deep structure, code snippets, mathematical formulas, and diagrams. Traditional viewers render them with rigid fonts and awkward formatting.

Muduck brings:
- 📜 **5 Curated Themes**: Editorial Paper, Modern Light, Midnight Dark, Nordic Frost, and Obsidian OLED.
- 🔤 **Fluid Typography**: Scalable font size, customizable font families (Book Serif, Modern Sans, Technical Mono), and column widths.
- 📑 **Instant Outline**: Auto-generated Table of Contents that tracks your reading position.
- ⚡ **Live Auto-Reload**: When an AI or background script modifies your file, Muduck updates seamlessly in real time!

---

## 2. GitHub-Style Callouts

> [!TIP]
> Use callouts to highlight key takeaways, executive summaries, or quick wins.

> [!IMPORTANT]
> Double-clicking any \`.md\` file in macOS Finder will open it directly inside Muduck.

> [!WARNING]
> Martingale or high-leverage trading strategies can incur steep drawdowns if stop-losses are omitted.

> [!CAUTION]
> Never commit sensitive API keys or private credentials into version control!

---

## 3. Interactive Mermaid Diagrams

Muduck automatically renders vector diagrams from \`\`\`mermaid code blocks:

\`\`\`mermaid
graph TD
    A[User Double Clicks .md File] --> B(macOS Launches Muduck)
    B --> C{File Type Valid?}
    C -->|Yes| D[Parse Headings & Generate TOC]
    C -->|No| E[Show Helpful Error]
    D --> F[Render KaTeX, Mermaid & Code Blocks]
    F --> G[Apply Selected Theme & Typography]
    G --> H[Monitor for AI Background Updates]
\`\`\`

---

## 4. Mathematical Equations (KaTeX)

Formulas are rendered cleanly with KaTeX support:

**Inline math:** The famous mass-energy equivalence is $E = mc^2$, and Euler's identity is $e^{i\\pi} + 1 = 0$.

**Block equation (Normal Distribution):**

$$f(x) = \\frac{1}{\\sigma \\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}$$

---

## 5. Rich Code Blocks with 1-Click Copy

\`\`\`python
# Example: Quantitative RSI Trend Momentum Strategy
import numpy as np
import pandas as pd

def calculate_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

print("Muduck: High performance markdown reader ready.")
\`\`\`

---

## 6. Structured Comparative Tables

| Setting | Recommendation | Rationale |
| :--- | :--- | :--- |
| **Theme** | *Editorial Paper* | Minimizes eye strain during long analytical reviews |
| **Scale** | 105% – 120% | Optimal optical size for high-DPI Retina displays |
| **Width** | Book (Focused) | 65–75 characters per line ensures highest reading speed |
| **Shortcuts** | \`Cmd + O\` / \`Cmd + S\` | Native macOS keyboard muscle-memory |

---

## 7. Productivity Checklist

- [x] Create project architecture
- [x] Implement 5 reading themes
- [x] Integrate Mermaid and KaTeX support
- [x] Support macOS Finder double-click and file association
- [ ] Open your own AI report and enjoy reading!

---
`;
