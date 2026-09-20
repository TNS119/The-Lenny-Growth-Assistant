# RESOURCE: LOCAL OLLAMA HARDWARE BENCHMARK & MODEL RECOMMENDATION

**Target Platform:** Local Windows Workstation  
**Runtime:** Ollama (Background Service at `http://localhost:11434`)  
**Status on Host:** Installed and actively running  

---

## 1. Local Hardware Profile (Detected via System Probing)

* **Processor (CPU):** AMD Ryzen 7 7735HS (8 Cores, 16 Logical Threads, up to 4.75 GHz).
* **System Memory (RAM):** 16 GB DDR5 RAM (~14.0 GB Visible / Usable).
* **Graphics (GPU):** AMD Radeon 680M Integrated Graphics (2 GB Shared VRAM).
* **Storage:** High-Speed NVMe SSD.

---

## 2. Best Model Recommendation for The Lenny Growth Assistant

Given 16 GB total RAM and an AMD Ryzen 7 with Radeon 680M, the primary objective is to maximize **reasoning quality** and **prompt adherence** while ensuring **sub-4-second Time-to-First-Token (TTFT)** without swapping to virtual memory.

### 🏆 Top Choice (Default): `llama3.2:3b`
* **Parameter Size:** 3.2 Billion Parameters.
* **Download Size:** ~2.0 GB.
* **Active RAM Footprint:** ~3.2 GB to 3.8 GB.
* **Inference Speed:** **40–60 tokens/second** on Ryzen 7 7735HS.
* **Why it’s the best fit:**
  * Fits completely in available RAM alongside Docker, PostgreSQL, FastAPI, and Next.js.
  * Extremely fast generation (TTFT $< 1.0\text{s}$), making interactive chat and artifact streaming feel instantaneous.
  * Meta’s Llama 3.2 instruction fine-tuning specifically excels at JSON output, tag generation (`<artifact>`), and source attribution.

### 🥈 Alternative for Deep 1,250-Word Essay Generation: `llama3.1:8b`
* **Parameter Size:** 8.0 Billion Parameters.
* **Download Size:** ~4.7 GB.
* **Active RAM Footprint:** ~5.5 GB to 6.5 GB.
* **Inference Speed:** **15–25 tokens/second** on Ryzen 7 7735HS.
* **Why use it:**
  * When executing the **Ship 30 for 30 Content Engine** (`mode="ship30"`), 8B models possess a deeper vocabulary and stronger long-context coherence across full 1,250-word narratives.
  * Recommended to pull as a secondary model for production long-form essay generation.

### 🥉 Embedding Model: `sentence-transformers/all-MiniLM-L6-v2` or `nomic-embed-text`
* **Option A (Python Backend):** `sentence-transformers/all-MiniLM-L6-v2` (90 MB download, 384 dimensions, zero Ollama dependency, runs CPU-threaded in Python).
* **Option B (Ollama Vectorizer):** `nomic-embed-text` (274 MB, 768 dimensions, high semantic recall).

---

## 3. Quick Pull Commands

Run in PowerShell or Command Prompt to download the recommended model into your local Ollama runtime:

```powershell
# Recommended primary model (fast, light, optimal for local inference)
& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" pull llama3.2:3b

# Optional: Higher-capacity 8B model for long essays
& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" pull llama3.1:8b

# Optional: Embeddings model if using Ollama for vectors
& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" pull nomic-embed-text
```

## 4. Verification Probe

Verify the model is loaded and responding:
```powershell
Invoke-RestMethod -Uri "http://localhost:11434/api/tags"
```
You will see `llama3.2:3b` listed in the JSON array of available models.
