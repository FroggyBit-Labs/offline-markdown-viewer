---
title: Example
author: FroggyBit Labs
---

# Rendering example

Text with **bold**, *italic*, `code` and a [link](https://example.org).

## Table

| Column A | Column B |
|----------|----------|
| 1        | 2        |

## Tasks

- [x] Markdown rendering
- [ ] Browser validation

## Mermaid

```mermaid
flowchart LR
  A[.md file] --> B{Local rendering}
  B --> C[marked]
  B --> D[mermaid]
```

```mermaid
sequenceDiagram
  User->>Extension: Opens a .md file
  Extension-->>User: Rendered page
```

## Code

```powershell
Get-ChildItem | Select-Object Name
```

## Security

<script>alert('blocked')</script>

![remote image](https://example.org/x.png)
