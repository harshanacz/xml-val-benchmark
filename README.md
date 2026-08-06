# xml-val-benchmark

Publication-grade multi-dimensional performance benchmark comparing WebAssembly XML validation engines: **`xmllint-wasm`** vs **`xerces-wasm`** across **Linux, macOS, and Windows** OS platforms.

---

## 🌐 Cross-Platform Performance Comparison (Node.js v22.x)

Verified via automated GitHub Actions Matrix CI/CD across Ubuntu Linux, macOS, and Windows NT:

| Scenario / Metric | OS Platform | `xmllint-wasm` | `xerces-wasm` | Speedup Ratio |
| :--- | :--- | :--- | :--- | :--- |
| **Single Schema Warm Loop** (1,000 runs) | **Linux (Ubuntu AMD EPYC)** | 54,911.11 ms | **97.95 ms** | **⚡ 560.6x faster** |
| | **macOS (Apple M1 Virtual)** | 42,998.64 ms | **115.58 ms** | **⚡ 372.0x faster** |
| | **Windows (Windows NT AMD EPYC)** | 78,687.36 ms | **106.14 ms** | **⚡ 741.4x faster** |
| **Multi-File Schemas** (4 Included XSDs) | **Linux (Ubuntu AMD EPYC)** | 57,203.18 ms | **159.65 ms** | **⚡ 358.3x faster** |
| | **macOS (Apple M1 Virtual)** | 37,220.40 ms | **173.92 ms** | **⚡ 214.0x faster** |
| | **Windows (Windows NT AMD EPYC)** | 80,739.03 ms | **158.36 ms** | **⚡ 509.8x faster** |
| **1.2 KB Small Payload** | **Linux** | 57.46 ms / val | **0.15 ms / val** | **⚡ 384.8x faster** |
| | **macOS** | 35.53 ms / val | **0.15 ms / val** | **⚡ 236.2x faster** |
| | **Windows** | 79.17 ms / val | **0.15 ms / val** | **⚡ 513.4x faster** |
| **100 KB Medium Payload** | **Linux** | 71.90 ms / val | **5.61 ms / val** | **⚡ 12.8x faster** |
| | **macOS** | 63.00 ms / val | **6.56 ms / val** | **⚡ 9.6x faster** |
| | **Windows** | 113.89 ms / val | **5.72 ms / val** | **⚡ 19.9x faster** |
| **1 MB Large Payload** | **Linux** | 113.61 ms / val | **56.03 ms / val** | **⚡ 2.03x faster** |
| | **macOS** | 75.22 ms / val | **62.50 ms / val** | **⚡ 1.20x faster** |
| | **Windows** | 171.82 ms / val | **61.12 ms / val** | **⚡ 2.81x faster** |
| **5 MB Mass Payload** | **Linux** | **224.12 ms / val** | 277.79 ms / val | **`xmllint-wasm` (1.24x faster)** |
| | **macOS** | **154.69 ms / val** | 299.86 ms / val | **`xmllint-wasm` (1.93x faster)** |
| | **Windows** | **279.82 ms / val** | 293.40 ms / val | **`xmllint-wasm` (1.05x faster)** |
| **Error Path Validation** (Missing Tag) | **Linux** | 59.03 ms / call | **0.17 ms / call** | **⚡ 356.0x faster** |
| | **macOS** | 34.17 ms / call | **0.14 ms / call** | **⚡ 239.2x faster** |
| | **Windows** | 85.19 ms / call | **0.19 ms / call** | **⚡ 459.2x faster** |

---

## 🔬 Architectural Execution Model & Trade-offs

A critical finding of this benchmark is that `xmllint-wasm` and `xerces-wasm` employ fundamentally different runtime execution architectures:

1. **`xmllint-wasm` (Worker-Thread Offloaded Architecture):**
   - Every `validateXML()` call spawns a dedicated Node.js `worker_threads.Worker`, instantiates the WASM module inside it, executes validation, and tears down the worker thread.
   - **Advantage:** **Zero Main-Thread Blocking.** Main event loop lag during validation is **<1.8 ms** even for 5MB payloads.
   - **Trade-off:** Pays a fixed OS thread spawn and worker creation tax (~23 ms - 79 ms depending on OS) per validation call.

2. **`xerces-wasm` (Synchronous Main-Thread WASM Architecture):**
   - `createProjectValidator()` pre-parses XSD schemas and caches the compiled Grammar Pool in C++ WASM heap memory. Subsequent `validate()` calls execute synchronously on the Node.js **Main Thread**.
   - **Advantage:** **Extreme Warm-Loop Throughput.** Eliminates worker spawn taxes and schema parsing overhead (~0.06 ms - 0.15 ms per call for standard payloads).
   - **Trade-off:** **Main-Thread Event Loop Freezing.** Validating large payloads (e.g. 5MB) blocks the main Node.js event loop for **~145 ms - 289 ms**, freezing all incoming HTTP requests, timers, and I/O.

> 💡 **Why `xmllint-wasm` is faster on 5 MB Mass Payloads:**  
> For massive XML documents (5MB+), fixed XSD schema compilation overhead becomes negligible compared to pure XML text parsing compute time. `xmllint-wasm` uses a streaming C SAX parser that scales throughput up to **~50 MB/s**, whereas `xerces-wasm`'s current synchronous main-thread C++ parser achieves **~35 MB/s** and blocks the Node.js event loop for ~145ms–290ms during large validations.  
>  
> 📌 **Future Roadmap Mitigation:**  
> To address main-thread event loop freezing and high-load resilience for multi-megabyte payloads, issue [#10 (`feat: Add high-load resilience & concurrency protection (Worker Threads & Payload Guards)`)](https://github.com/harshanacz/xerces-wasm-validator/issues/10) is already listed on the `xerces-wasm` roadmap. This feature will introduce optional worker thread offloading and payload size guards to deliver high-load enterprise resilience.

---

## 📊 Detailed Module Analysis (Local Baseline: Apple M4)

### Module 1: Standard Schema Validation (1,000 Iterations)

#### 1A. Single Schema (`sample.xsd`)
| Engine | Isolated Cold Start | Warm Loop Mean (± StdDev) | Warm Loop Min / Max | Speedup Ratio |
| :--- | :--- | :--- | :--- | :--- |
| **`xmllint-wasm`** | 35.52 ms | 22,908.82 ms (±521.72 ms) | 22,084.57 ms / 23,373.96 ms | Baseline |
| **`xerces-wasm`** | **22.66 ms** | **41.71 ms (±6.59 ms)** | **37.54 ms / 54.79 ms** | **549.2x faster** |

#### 1B. Multi-File Modular Schemas (4 Included XSDs)
| Engine | Isolated Cold Start | Warm Loop Mean (± StdDev) | Warm Loop Min / Max | Speedup Ratio |
| :--- | :--- | :--- | :--- | :--- |
| **`xmllint-wasm`** | 35.73 ms | 23,916.85 ms (±1017.20 ms) | 22,929.79 ms / 25,844.40 ms | Baseline |
| **`xerces-wasm`** | **25.38 ms** | **69.06 ms (±1.95 ms)** | **67.82 ms / 72.94 ms** | **346.3x faster** |

---

### Module 4: Event-Loop Lag, Memory & Concurrency

#### 4A. Native Event Loop Freeze (`node:perf_hooks monitorEventLoopDelay`)
| Engine | Total Duration | Native Event-Loop Freeze | Thread Execution |
| :--- | :--- | :--- | :--- |
| **`xmllint-wasm`** | 103.15 ms | **1.76 ms** | Offloaded Worker Thread (Non-Blocking) |
| **`xerces-wasm`** | 143.74 ms | **144.93 ms** | Synchronous Main Thread (Freezes Event Loop) |

#### 4B. Main-Thread Memory Allocation Footprint
| Engine | Main-Thread Heap Delta | Execution Memory Model |
| :--- | :--- | :--- |
| **`xmllint-wasm`** | +2.25 MB | Isolated inside transient Worker Threads |
| **`xerces-wasm`** | **+0.41 MB** | C++ WASM Heap in Main Process |

#### 4C. Parallel Execution (`Promise.all` across 50 Concurrent Validations)
| Engine | 50 Concurrent Promises | Execution Behavior |
| :--- | :--- | :--- |
| **`xmllint-wasm`** | 221.58 ms | Parallel execution scaling across OS thread pool |
| **`xerces-wasm`** | **3.57 ms** | Serialized synchronous execution on main thread |

---

## 🚀 Setup & How to Run

### 1. Prerequisites
- Node.js (v18+ recommended)

### 2. Installation & Fixture Generation
```bash
git clone https://github.com/harshanacz/xml-val-benchmark.git
cd xml-val-benchmark
npm install
node src/generate-fixtures.js
```

### 3. Run Benchmark Suite
Run the full multi-dimensional benchmark suite:

```bash
npm start
```
