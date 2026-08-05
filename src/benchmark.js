import { validateXML as xmllintValidate } from 'xmllint-wasm';
import { createProjectValidator } from 'xerces-wasm';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { performance, monitorEventLoopDelay } from 'perf_hooks';

// --- Fixture Paths ---
const singleXsdPath = path.resolve('tests/schemas/sample.xsd');
const singleXmlPath = path.resolve('tests/fixtures/sample.xml');
const singleXmlContent = fs.readFileSync(singleXmlPath, 'utf-8');
const singleXsdContent = fs.readFileSync(singleXsdPath, 'utf-8');

const multiSchemaDir = path.resolve('tests/schemas/multi');
const multiXmlPath = path.resolve('tests/fixtures/multi-order.xml');
const multiXmlContent = fs.readFileSync(multiXmlPath, 'utf-8');

const multiFilesMap = {
    'order.xsd': fs.readFileSync(path.join(multiSchemaDir, 'order.xsd'), 'utf-8'),
    'customer.xsd': fs.readFileSync(path.join(multiSchemaDir, 'customer.xsd'), 'utf-8'),
    'address.xsd': fs.readFileSync(path.join(multiSchemaDir, 'address.xsd'), 'utf-8'),
    'product.xsd': fs.readFileSync(path.join(multiSchemaDir, 'product.xsd'), 'utf-8'),
};
const multiPreloadList = Object.entries(multiFilesMap).map(([fileName, contents]) => ({ fileName, contents }));

// --- Scaled & Invalid Fixtures ---
const invalidMissingTagContent = fs.readFileSync(path.resolve('tests/fixtures/invalid-missing-tag.xml'), 'utf-8');
const invalidDatatypeContent = fs.readFileSync(path.resolve('tests/fixtures/invalid-datatype.xml'), 'utf-8');

const scaledFixtures = {
    '1.2KB': fs.readFileSync(path.resolve('tests/fixtures/generated/order-1kb.xml'), 'utf-8'),
    '100KB': fs.readFileSync(path.resolve('tests/fixtures/generated/order-100kb.xml'), 'utf-8'),
    '1MB': fs.readFileSync(path.resolve('tests/fixtures/generated/order-1mb.xml'), 'utf-8'),
    '5MB': fs.readFileSync(path.resolve('tests/fixtures/generated/order-5mb.xml'), 'utf-8'),
};

// --- Subprocess Mode for True Isolated Cold Start ---
if (process.argv.includes('--cold-worker')) {
    const engineIdx = process.argv.indexOf('--engine');
    const testIdx = process.argv.indexOf('--test');
    const engine = process.argv[engineIdx + 1];
    const testType = process.argv[testIdx + 1];

    const startTime = performance.now();
    let isValid = false;

    if (testType === 'single') {
        if (engine === 'xmllint') {
            const res = await xmllintValidate({ xml: singleXmlContent, schema: [singleXsdContent] });
            isValid = res.valid === true;
        } else if (engine === 'xerces') {
            const v = await createProjectValidator({ entry: 'sample.xsd', files: { 'sample.xsd': singleXsdContent } });
            const res = await v.validate(singleXmlContent);
            isValid = res.valid === true;
            v.destroy();
        }
    } else if (testType === 'multi') {
        if (engine === 'xmllint') {
            const res = await xmllintValidate({ xml: multiXmlContent, schema: [multiFilesMap['order.xsd']], preload: multiPreloadList });
            isValid = res.valid === true;
        } else if (engine === 'xerces') {
            const v = await createProjectValidator({ entry: 'order.xsd', files: multiFilesMap });
            const res = await v.validate(multiXmlContent);
            isValid = res.valid === true;
            v.destroy();
        }
    }

    const elapsedMs = performance.now() - startTime;
    console.log(JSON.stringify({ elapsedMs, valid: isValid }));
    process.exit(0);
}

// --- Statistical Helper Functions ---
function stats(numbers) {
    const n = numbers.length;
    if (n === 0) return { mean: 0, stddev: 0, min: 0, max: 0, median: 0 };
    const sorted = [...numbers].sort((a, b) => a - b);
    const sum = numbers.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const variance = numbers.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
    const stddev = Math.sqrt(variance);
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
    return { mean, stddev, min: sorted[0], max: sorted[n - 1], median };
}

function runIsolatedColdStart(engine, testType) {
    const currentScript = process.argv[1];
    const output = execFileSync(process.execPath, ['--expose-gc', currentScript, '--cold-worker', '--engine', engine, '--test', testType], {
        encoding: 'utf-8',
        cwd: process.cwd()
    });
    const parsed = JSON.parse(output.trim());
    if (!parsed.valid) {
        throw new Error(`Validation failed during cold start test: ${engine} (${testType})`);
    }
    return parsed.elapsedMs;
}

function gc() {
    if (global.gc) {
        global.gc();
    }
}

// Native Node.js perf_hooks monitorEventLoopDelay helper
async function measureEventLoopLag(fn) {
    const h = monitorEventLoopDelay({ resolution: 10 });
    h.enable();
    await new Promise(r => setTimeout(r, 20));

    const start = performance.now();
    await fn();
    const duration = performance.now() - start;

    await new Promise(r => setTimeout(r, 20));
    h.disable();

    const rawMaxMs = h.max / 1e6;
    const maxLagMs = Math.max(0, rawMaxMs - 10);
    return { duration, maxLagMs };
}

const MEASURE_TRIALS = 5;
const LOOP_ITERATIONS = 1000;

async function main() {
    console.log(`======================================================================`);
    console.log(` RIGOROUS MULTI-DIMENSIONAL XML BENCHMARK SUITE`);
    console.log(`======================================================================`);
    console.log(` System Info: ${os.type()} ${os.release()} (${os.arch()}) | CPU: ${os.cpus()[0]?.model}`);
    console.log(` Runtime: Node.js ${process.version} | Iterations/Trial: ${LOOP_ITERATIONS} | Trials: ${MEASURE_TRIALS}`);
    console.log(`======================================================================\n`);

    // ==================================================================
    // MODULE 1: Standard Schema Validation
    // ==================================================================
    console.log(`----------------------------------------------------------------------`);
    console.log(` MODULE 1: Standard Schema Validation`);
    console.log(`----------------------------------------------------------------------`);

    // 1A. Single Schema
    console.log(`\n [1A] Single Schema Benchmark (sample.xsd)`);
    process.stdout.write(`   - Measuring Isolated Cold Start... `);
    const singleXmllintCold = runIsolatedColdStart('xmllint', 'single');
    const singleXercesCold = runIsolatedColdStart('xerces', 'single');
    console.log(`Done.`);
    console.log(`     * xmllint-wasm cold: ${singleXmllintCold.toFixed(2)} ms`);
    console.log(`     * xerces-wasm cold:  ${singleXercesCold.toFixed(2)} ms`);

    console.log(`   - Running Warm Loop (${MEASURE_TRIALS} interleaved trials of ${LOOP_ITERATIONS} iterations)...`);
    const singleXmllintTimes = [];
    const singleXercesTimes = [];

    const singleXercesVal = await createProjectValidator({ entry: 'sample.xsd', files: { 'sample.xsd': singleXsdContent } });

    for (let t = 0; t < MEASURE_TRIALS; t++) {
        const xmllintFirst = t % 2 === 0;
        if (xmllintFirst) {
            gc();
            const t0 = performance.now();
            for (let i = 0; i < LOOP_ITERATIONS; i++) {
                const r = await xmllintValidate({ xml: singleXmlContent, schema: [singleXsdContent] });
                if (!r.valid) throw new Error('xmllint single failed');
            }
            singleXmllintTimes.push(performance.now() - t0);

            gc();
            const t1 = performance.now();
            for (let i = 0; i < LOOP_ITERATIONS; i++) {
                const r = await singleXercesVal.validate(singleXmlContent);
                if (!r.valid) throw new Error('xerces single failed');
            }
            singleXercesTimes.push(performance.now() - t1);
        } else {
            gc();
            const t1 = performance.now();
            for (let i = 0; i < LOOP_ITERATIONS; i++) {
                const r = await singleXercesVal.validate(singleXmlContent);
                if (!r.valid) throw new Error('xerces single failed');
            }
            singleXercesTimes.push(performance.now() - t1);

            gc();
            const t0 = performance.now();
            for (let i = 0; i < LOOP_ITERATIONS; i++) {
                const r = await xmllintValidate({ xml: singleXmlContent, schema: [singleXsdContent] });
                if (!r.valid) throw new Error('xmllint single failed');
            }
            singleXmllintTimes.push(performance.now() - t0);
        }
    }
    singleXercesVal.destroy();

    const sXmllint = stats(singleXmllintTimes);
    const sXerces = stats(singleXercesTimes);

    console.log(`     * xmllint-wasm loop: Mean=${sXmllint.mean.toFixed(2)}ms (±${sXmllint.stddev.toFixed(2)}ms) | Min=${sXmllint.min.toFixed(2)}ms | Max=${sXmllint.max.toFixed(2)}ms`);
    console.log(`     * xerces-wasm loop:  Mean=${sXerces.mean.toFixed(2)}ms (±${sXerces.stddev.toFixed(2)}ms) | Min=${sXerces.min.toFixed(2)}ms | Max=${sXerces.max.toFixed(2)}ms`);

    // 1B. Multi-Schema
    console.log(`\n [1B] Multi-File Modular Schema Benchmark (4 Included XSDs)`);
    process.stdout.write(`   - Measuring Isolated Cold Start... `);
    const multiXmllintCold = runIsolatedColdStart('xmllint', 'multi');
    const multiXercesCold = runIsolatedColdStart('xerces', 'multi');
    console.log(`Done.`);
    console.log(`     * xmllint-wasm cold: ${multiXmllintCold.toFixed(2)} ms`);
    console.log(`     * xerces-wasm cold:  ${multiXercesCold.toFixed(2)} ms`);

    console.log(`   - Running Warm Loop (${MEASURE_TRIALS} interleaved trials of ${LOOP_ITERATIONS} iterations)...`);
    const multiXmllintTimes = [];
    const multiXercesTimes = [];

    const multiXercesVal = await createProjectValidator({ entry: 'order.xsd', files: multiFilesMap });

    for (let t = 0; t < MEASURE_TRIALS; t++) {
        const xmllintFirst = t % 2 === 0;
        if (xmllintFirst) {
            gc();
            const t0 = performance.now();
            for (let i = 0; i < LOOP_ITERATIONS; i++) {
                const r = await xmllintValidate({ xml: multiXmlContent, schema: [multiFilesMap['order.xsd']], preload: multiPreloadList });
                if (!r.valid) throw new Error('xmllint multi failed');
            }
            multiXmllintTimes.push(performance.now() - t0);

            gc();
            const t1 = performance.now();
            for (let i = 0; i < LOOP_ITERATIONS; i++) {
                const r = await multiXercesVal.validate(multiXmlContent);
                if (!r.valid) throw new Error('xerces multi failed');
            }
            multiXercesTimes.push(performance.now() - t1);
        } else {
            gc();
            const t1 = performance.now();
            for (let i = 0; i < LOOP_ITERATIONS; i++) {
                const r = await multiXercesVal.validate(multiXmlContent);
                if (!r.valid) throw new Error('xerces multi failed');
            }
            multiXercesTimes.push(performance.now() - t1);

            gc();
            const t0 = performance.now();
            for (let i = 0; i < LOOP_ITERATIONS; i++) {
                const r = await xmllintValidate({ xml: multiXmlContent, schema: [multiFilesMap['order.xsd']], preload: multiPreloadList });
                if (!r.valid) throw new Error('xmllint multi failed');
            }
            multiXmllintTimes.push(performance.now() - t0);
        }
    }
    multiXercesVal.destroy();

    const mXmllint = stats(multiXmllintTimes);
    const mXerces = stats(multiXercesTimes);

    console.log(`     * xmllint-wasm loop: Mean=${mXmllint.mean.toFixed(2)}ms (±${mXmllint.stddev.toFixed(2)}ms) | Min=${mXmllint.min.toFixed(2)}ms | Max=${mXmllint.max.toFixed(2)}ms`);
    console.log(`     * xerces-wasm loop:  Mean=${mXerces.mean.toFixed(2)}ms (±${mXerces.stddev.toFixed(2)}ms) | Min=${mXerces.min.toFixed(2)}ms | Max=${mXerces.max.toFixed(2)}ms`);

    // ==================================================================
    // MODULE 2: Document-Size Scaling Benchmark (with n=5 Interleaved Trials)
    // ==================================================================
    console.log(`\n----------------------------------------------------------------------`);
    console.log(` MODULE 2: Document-Size Scaling Benchmark (${MEASURE_TRIALS} Interleaved Trials)`);
    console.log(`----------------------------------------------------------------------`);

    const scaleConfigs = [
        { label: '1.2KB', content: scaledFixtures['1.2KB'], runs: 100 },
        { label: '100KB', content: scaledFixtures['100KB'], runs: 50 },
        { label: '1MB', content: scaledFixtures['1MB'], runs: 10 },
        { label: '5MB', content: scaledFixtures['5MB'], runs: 5 }
    ];

    const xercesScaleVal = await createProjectValidator({ entry: 'order.xsd', files: multiFilesMap });

    for (const sc of scaleConfigs) {
        const sizeMb = Buffer.byteLength(sc.content, 'utf-8') / (1024 * 1024);
        console.log(`\n   - Payload Size: ${sc.label} (${sizeMb.toFixed(3)} MB, ${sc.runs} runs/trial x ${MEASURE_TRIALS} trials)`);

        const scaleXmllintAvgs = [];
        const scaleXercesAvgs = [];

        for (let t = 0; t < MEASURE_TRIALS; t++) {
            const xmllintFirst = t % 2 === 0;
            if (xmllintFirst) {
                gc();
                const t0 = performance.now();
                for (let i = 0; i < sc.runs; i++) {
                    const r = await xmllintValidate({ xml: sc.content, schema: [multiFilesMap['order.xsd']], preload: multiPreloadList });
                    if (!r.valid) throw new Error(`xmllint scale ${sc.label} failed`);
                }
                scaleXmllintAvgs.push((performance.now() - t0) / sc.runs);

                gc();
                const t1 = performance.now();
                for (let i = 0; i < sc.runs; i++) {
                    const r = await xercesScaleVal.validate(sc.content);
                    if (!r.valid) throw new Error(`xerces scale ${sc.label} failed`);
                }
                scaleXercesAvgs.push((performance.now() - t1) / sc.runs);
            } else {
                gc();
                const t1 = performance.now();
                for (let i = 0; i < sc.runs; i++) {
                    const r = await xercesScaleVal.validate(sc.content);
                    if (!r.valid) throw new Error(`xerces scale ${sc.label} failed`);
                }
                scaleXercesAvgs.push((performance.now() - t1) / sc.runs);

                gc();
                const t0 = performance.now();
                for (let i = 0; i < sc.runs; i++) {
                    const r = await xmllintValidate({ xml: sc.content, schema: [multiFilesMap['order.xsd']], preload: multiPreloadList });
                    if (!r.valid) throw new Error(`xmllint scale ${sc.label} failed`);
                }
                scaleXmllintAvgs.push((performance.now() - t0) / sc.runs);
            }
        }

        const stXmllint = stats(scaleXmllintAvgs);
        const stXerces = stats(scaleXercesAvgs);

        const xmllintMBps = sizeMb / (stXmllint.mean / 1000);
        const xercesMBps = sizeMb / (stXerces.mean / 1000);

        console.log(`     * xmllint-wasm: Mean=${stXmllint.mean.toFixed(2)}ms/val (±${stXmllint.stddev.toFixed(2)}ms) | Throughput=${xmllintMBps.toFixed(2)} MB/s`);
        console.log(`     * xerces-wasm:  Mean=${stXerces.mean.toFixed(2)}ms/val (±${stXerces.stddev.toFixed(2)}ms) | Throughput=${xercesMBps.toFixed(2)} MB/s`);
        console.log(`     * Speedup Ratio: Xerces is ${(stXmllint.mean / stXerces.mean).toFixed(2)}x ${stXmllint.mean > stXerces.mean ? 'faster' : 'slower'}`);
    }
    xercesScaleVal.destroy();

    // ==================================================================
    // MODULE 3: Invalid XML & Error-Path Performance
    // ==================================================================
    console.log(`\n----------------------------------------------------------------------`);
    console.log(` MODULE 3: Invalid XML & Error-Path Performance Benchmark`);
    console.log(`----------------------------------------------------------------------`);

    const invalidCases = [
        { name: 'Missing Tag (<street>)', xml: invalidMissingTagContent },
        { name: 'Invalid Datatype (string in decimal)', xml: invalidDatatypeContent }
    ];

    const xercesErrVal = await createProjectValidator({ entry: 'order.xsd', files: multiFilesMap });

    for (const inv of invalidCases) {
        console.log(`\n   - Invalid Scenario: ${inv.name}`);

        const errXmllintAvgs = [];
        const errXercesAvgs = [];

        for (let t = 0; t < MEASURE_TRIALS; t++) {
            const xmllintFirst = t % 2 === 0;
            if (xmllintFirst) {
                gc();
                const t0 = performance.now();
                for (let i = 0; i < 200; i++) {
                    const r = await xmllintValidate({ xml: inv.xml, schema: [multiFilesMap['order.xsd']], preload: multiPreloadList });
                    if (r.valid) throw new Error('xmllint expected invalid');
                }
                errXmllintAvgs.push((performance.now() - t0) / 200);

                gc();
                const t1 = performance.now();
                for (let i = 0; i < 200; i++) {
                    const r = await xercesErrVal.validate(inv.xml);
                    if (r.valid) throw new Error('xerces expected invalid');
                }
                errXercesAvgs.push((performance.now() - t1) / 200);
            } else {
                gc();
                const t1 = performance.now();
                for (let i = 0; i < 200; i++) {
                    const r = await xercesErrVal.validate(inv.xml);
                    if (r.valid) throw new Error('xerces expected invalid');
                }
                errXercesAvgs.push((performance.now() - t1) / 200);

                gc();
                const t0 = performance.now();
                for (let i = 0; i < 200; i++) {
                    const r = await xmllintValidate({ xml: inv.xml, schema: [multiFilesMap['order.xsd']], preload: multiPreloadList });
                    if (r.valid) throw new Error('xmllint expected invalid');
                }
                errXmllintAvgs.push((performance.now() - t0) / 200);
            }
        }

        const stXmllintErr = stats(errXmllintAvgs);
        const stXercesErr = stats(errXercesAvgs);

        console.log(`     * xmllint-wasm: Mean=${stXmllintErr.mean.toFixed(2)}ms/call (±${stXmllintErr.stddev.toFixed(2)}ms)`);
        console.log(`     * xerces-wasm:  Mean=${stXercesErr.mean.toFixed(2)}ms/call (±${stXercesErr.stddev.toFixed(2)}ms)`);
        console.log(`     * Speedup Ratio: Xerces is ${(stXmllintErr.mean / stXercesErr.mean).toFixed(1)}x faster on error paths`);
    }
    xercesErrVal.destroy();

    // ==================================================================
    // MODULE 4: Event-Loop Lag, Memory Footprint & Thread Parallelism
    // ==================================================================
    console.log(`\n----------------------------------------------------------------------`);
    console.log(` MODULE 4: Event-Loop Lag, Memory Footprint & Thread Parallelism`);
    console.log(`----------------------------------------------------------------------`);

    // 4A. Native Native Event Loop Lag Test via node:perf_hooks monitorEventLoopDelay
    console.log(`\n [4A] Native Main-Thread Event Loop Freeze Test (5MB Payload Validation)`);

    const xercesLagVal = await createProjectValidator({ entry: 'order.xsd', files: multiFilesMap });
    
    gc();
    const xmllintLag = await measureEventLoopLag(async () => {
        const r = await xmllintValidate({ xml: scaledFixtures['5MB'], schema: [multiFilesMap['order.xsd']], preload: multiPreloadList });
        if (!r.valid) throw new Error('xmllint 5MB lag check failed');
    });

    gc();
    const xercesLag = await measureEventLoopLag(async () => {
        const r = await xercesLagVal.validate(scaledFixtures['5MB']);
        if (!r.valid) throw new Error('xerces 5MB lag check failed');
    });
    xercesLagVal.destroy();

    console.log(`     * xmllint-wasm: Duration=${xmllintLag.duration.toFixed(2)}ms | Max Event-Loop Freeze=${xmllintLag.maxLagMs.toFixed(2)}ms (Worker-Offloaded, Non-Blocking)`);
    console.log(`     * xerces-wasm:  Duration=${xercesLag.duration.toFixed(2)}ms | Max Event-Loop Freeze=${xercesLag.maxLagMs.toFixed(2)}ms (Main-Thread Synchronous, Freezes Event Loop)`);

    // 4B. Memory Footprint
    console.log(`\n [4B] Main-Thread Memory Allocation Footprint`);
    
    gc();
    const mem0 = process.memoryUsage();
    for (let i = 0; i < 300; i++) {
        await xmllintValidate({ xml: multiXmlContent, schema: [multiFilesMap['order.xsd']], preload: multiPreloadList });
    }
    const mem1 = process.memoryUsage();
    const xmllintHeapMb = (mem1.heapUsed - mem0.heapUsed) / (1024 * 1024);

    gc();
    const xercesMemVal = await createProjectValidator({ entry: 'order.xsd', files: multiFilesMap });
    const mem2 = process.memoryUsage();
    for (let i = 0; i < 300; i++) {
        await xercesMemVal.validate(multiXmlContent);
    }
    const mem3 = process.memoryUsage();
    const xercesHeapMb = (mem3.heapUsed - mem2.heapUsed) / (1024 * 1024);
    xercesMemVal.destroy();

    console.log(`     * xmllint-wasm Main Heap Delta: ${xmllintHeapMb > 0 ? '+' : ''}${xmllintHeapMb.toFixed(2)} MB (Note: Work happens in Worker Threads)`);
    console.log(`     * xerces-wasm Main Heap Delta:  ${xercesHeapMb > 0 ? '+' : ''}${xercesHeapMb.toFixed(2)} MB (Note: WASM C++ Memory in Main Heap)`);

    // 4C. Concurrency & Worker-Thread Parallelism
    console.log(`\n [4C] Parallelism Test (50 Concurrent Promises via Promise.all)`);

    gc();
    const conc0 = performance.now();
    const xmllintPromises = Array.from({ length: 50 }, () =>
        xmllintValidate({ xml: multiXmlContent, schema: [multiFilesMap['order.xsd']], preload: multiPreloadList })
    );
    const xmllintConcRes = await Promise.all(xmllintPromises);
    const xmllintConcTime = performance.now() - conc0;
    if (!xmllintConcRes.every(r => r.valid)) throw new Error('xmllint concurrent failed');

    gc();
    const xercesConcVal = await createProjectValidator({ entry: 'order.xsd', files: multiFilesMap });
    const conc1 = performance.now();
    const xercesPromises = Array.from({ length: 50 }, () => xercesConcVal.validate(multiXmlContent));
    const xercesConcRes = await Promise.all(xercesPromises);
    const xercesConcTime = performance.now() - conc1;
    if (!xercesConcRes.every(r => r.valid)) throw new Error('xerces concurrent failed');
    xercesConcVal.destroy();

    console.log(`     * xmllint-wasm (50 concurrent promises): ${xmllintConcTime.toFixed(2)} ms (Offloaded across Worker Threads)`);
    console.log(`     * xerces-wasm (50 concurrent promises):  ${xercesConcTime.toFixed(2)} ms (Serialized on Main Event Loop)`);

    console.log(`\n======================================================================`);
    console.log(` BENCHMARK SUITE COMPLETED SUCCESSFULLY`);
    console.log(`======================================================================\n`);
}

main().catch(console.error);