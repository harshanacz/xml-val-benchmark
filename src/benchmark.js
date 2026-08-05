import { validateXML as xmllintValidate } from 'xmllint-wasm';
import { createProjectValidator } from 'xerces-wasm';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { performance } from 'perf_hooks';

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
            const v = await createProjectValidator({
                entry: 'sample.xsd',
                files: { 'sample.xsd': singleXsdContent }
            });
            const res = await v.validate(singleXmlContent);
            isValid = res.valid === true;
            v.destroy();
        }
    } else if (testType === 'multi') {
        if (engine === 'xmllint') {
            const res = await xmllintValidate({
                xml: multiXmlContent,
                schema: [multiFilesMap['order.xsd']],
                preload: multiPreloadList
            });
            isValid = res.valid === true;
        } else if (engine === 'xerces') {
            const v = await createProjectValidator({
                entry: 'order.xsd',
                files: multiFilesMap
            });
            const res = await v.validate(multiXmlContent);
            isValid = res.valid === true;
            v.destroy();
        }
    }

    const elapsedMs = performance.now() - startTime;
    console.log(JSON.stringify({ elapsedMs, valid: isValid }));
    process.exit(0);
}

// --- Helper Functions for Statistical Analysis ---
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

// --- Configuration ---
const MEASURE_TRIALS = 5;
const LOOP_ITERATIONS = 1000;

async function main() {
    console.log(`======================================================================`);
    console.log(` RIGOROUS XML VALIDATION BENCHMARK SUITE`);
    console.log(`======================================================================`);
    console.log(` System Info: ${os.type()} ${os.release()} (${os.arch()}) | CPU: ${os.cpus()[0]?.model}`);
    console.log(` Runtime: Node.js ${process.version} | Iterations/Trial: ${LOOP_ITERATIONS} | Trials: ${MEASURE_TRIALS}`);
    console.log(`======================================================================\n`);

    // ==================================================================
    // TEST 1: Single Schema Benchmark
    // ==================================================================
    console.log(`----------------------------------------------------------------------`);
    console.log(` TEST 1: Single Schema Benchmark (sample.xsd)`);
    console.log(`----------------------------------------------------------------------`);

    // 1A. True Isolated Cold Start
    process.stdout.write(` Measuring Isolated Cold Start... `);
    const singleXmllintCold = runIsolatedColdStart('xmllint', 'single');
    const singleXercesCold = runIsolatedColdStart('xerces', 'single');
    console.log(`Done.`);
    console.log(`   - xmllint-wasm cold: ${singleXmllintCold.toFixed(2)} ms`);
    console.log(`   - xerces-wasm cold:  ${singleXercesCold.toFixed(2)} ms\n`);

    // 1B. Interleaved Warm Loop Trials
    console.log(` Running Warm Loop Benchmark (${MEASURE_TRIALS} trials of ${LOOP_ITERATIONS} iterations, interleaved)...`);

    const singleXmllintTimes = [];
    const singleXercesTimes = [];

    // Warmup
    gc();
    const initRes = await xmllintValidate({ xml: singleXmlContent, schema: [singleXsdContent] });
    if (!initRes.valid) throw new Error('xmllint single validation failed');
    
    const singleXercesVal = await createProjectValidator({ entry: 'sample.xsd', files: { 'sample.xsd': singleXsdContent } });
    const initXerRes = await singleXercesVal.validate(singleXmlContent);
    if (!initXerRes.valid) throw new Error('xerces single validation failed');

    for (let t = 0; t < MEASURE_TRIALS; t++) {
        // Interleave order on odd trials
        const xmllintFirst = t % 2 === 0;

        if (xmllintFirst) {
            gc();
            const t0 = performance.now();
            for (let i = 0; i < LOOP_ITERATIONS; i++) {
                const r = await xmllintValidate({ xml: singleXmlContent, schema: [singleXsdContent] });
                if (!r.valid) throw new Error('xmllint single loop failed');
            }
            singleXmllintTimes.push(performance.now() - t0);

            gc();
            const t1 = performance.now();
            for (let i = 0; i < LOOP_ITERATIONS; i++) {
                const r = await singleXercesVal.validate(singleXmlContent);
                if (!r.valid) throw new Error('xerces single loop failed');
            }
            singleXercesTimes.push(performance.now() - t1);
        } else {
            gc();
            const t1 = performance.now();
            for (let i = 0; i < LOOP_ITERATIONS; i++) {
                const r = await singleXercesVal.validate(singleXmlContent);
                if (!r.valid) throw new Error('xerces single loop failed');
            }
            singleXercesTimes.push(performance.now() - t1);

            gc();
            const t0 = performance.now();
            for (let i = 0; i < LOOP_ITERATIONS; i++) {
                const r = await xmllintValidate({ xml: singleXmlContent, schema: [singleXsdContent] });
                if (!r.valid) throw new Error('xmllint single loop failed');
            }
            singleXmllintTimes.push(performance.now() - t0);
        }
    }

    singleXercesVal.destroy();

    const sXmllint = stats(singleXmllintTimes);
    const sXerces = stats(singleXercesTimes);

    console.log(`   - xmllint-wasm loop: Mean=${sXmllint.mean.toFixed(2)}ms (±${sXmllint.stddev.toFixed(2)}ms) | Min=${sXmllint.min.toFixed(2)}ms | Max=${sXmllint.max.toFixed(2)}ms`);
    console.log(`   - xerces-wasm loop:  Mean=${sXerces.mean.toFixed(2)}ms (±${sXerces.stddev.toFixed(2)}ms) | Min=${sXerces.min.toFixed(2)}ms | Max=${sXerces.max.toFixed(2)}ms`);

    // ==================================================================
    // TEST 2: Multi-File Modular Schema Benchmark
    // ==================================================================
    console.log(`\n----------------------------------------------------------------------`);
    console.log(` TEST 2: Multi-File Modular Schemas (4 Included XSDs)`);
    console.log(`----------------------------------------------------------------------`);

    // 2A. True Isolated Cold Start
    process.stdout.write(` Measuring Isolated Cold Start... `);
    const multiXmllintCold = runIsolatedColdStart('xmllint', 'multi');
    const multiXercesCold = runIsolatedColdStart('xerces', 'multi');
    console.log(`Done.`);
    console.log(`   - xmllint-wasm cold: ${multiXmllintCold.toFixed(2)} ms`);
    console.log(`   - xerces-wasm cold:  ${multiXercesCold.toFixed(2)} ms\n`);

    // 2B. Interleaved Warm Loop Trials
    console.log(` Running Warm Loop Benchmark (${MEASURE_TRIALS} trials of ${LOOP_ITERATIONS} iterations, interleaved)...`);

    const multiXmllintTimes = [];
    const multiXercesTimes = [];

    // Warmup & Correctness Check
    gc();
    const initMultiLint = await xmllintValidate({ xml: multiXmlContent, schema: [multiFilesMap['order.xsd']], preload: multiPreloadList });
    if (!initMultiLint.valid) throw new Error('xmllint multi validation failed');

    const multiXercesVal = await createProjectValidator({ entry: 'order.xsd', files: multiFilesMap });
    const initMultiXer = await multiXercesVal.validate(multiXmlContent);
    if (!initMultiXer.valid) throw new Error('xerces multi validation failed');

    for (let t = 0; t < MEASURE_TRIALS; t++) {
        const xmllintFirst = t % 2 === 0;

        if (xmllintFirst) {
            gc();
            const t0 = performance.now();
            for (let i = 0; i < LOOP_ITERATIONS; i++) {
                const r = await xmllintValidate({ xml: multiXmlContent, schema: [multiFilesMap['order.xsd']], preload: multiPreloadList });
                if (!r.valid) throw new Error('xmllint multi loop failed');
            }
            multiXmllintTimes.push(performance.now() - t0);

            gc();
            const t1 = performance.now();
            for (let i = 0; i < LOOP_ITERATIONS; i++) {
                const r = await multiXercesVal.validate(multiXmlContent);
                if (!r.valid) throw new Error('xerces multi loop failed');
            }
            multiXercesTimes.push(performance.now() - t1);
        } else {
            gc();
            const t1 = performance.now();
            for (let i = 0; i < LOOP_ITERATIONS; i++) {
                const r = await multiXercesVal.validate(multiXmlContent);
                if (!r.valid) throw new Error('xerces multi loop failed');
            }
            multiXercesTimes.push(performance.now() - t1);

            gc();
            const t0 = performance.now();
            for (let i = 0; i < LOOP_ITERATIONS; i++) {
                const r = await xmllintValidate({ xml: multiXmlContent, schema: [multiFilesMap['order.xsd']], preload: multiPreloadList });
                if (!r.valid) throw new Error('xmllint multi loop failed');
            }
            multiXmllintTimes.push(performance.now() - t0);
        }
    }

    multiXercesVal.destroy();

    const mXmllint = stats(multiXmllintTimes);
    const mXerces = stats(multiXercesTimes);

    console.log(`   - xmllint-wasm loop: Mean=${mXmllint.mean.toFixed(2)}ms (±${mXmllint.stddev.toFixed(2)}ms) | Min=${mXmllint.min.toFixed(2)}ms | Max=${mXmllint.max.toFixed(2)}ms`);
    console.log(`   - xerces-wasm loop:  Mean=${mXerces.mean.toFixed(2)}ms (±${mXerces.stddev.toFixed(2)}ms) | Min=${mXerces.min.toFixed(2)}ms | Max=${mXerces.max.toFixed(2)}ms`);

    console.log(`\n======================================================================`);
    console.log(` SUMMARY & RATIOS`);
    console.log(`======================================================================`);
    console.log(` Test 1 Warm Loop Speedup: (xmllint ${sXmllint.mean.toFixed(1)}ms vs xerces ${sXerces.mean.toFixed(1)}ms) => Xerces is ${(sXmllint.mean / sXerces.mean).toFixed(1)}x faster`);
    console.log(` Test 2 Warm Loop Speedup: (xmllint ${mXmllint.mean.toFixed(1)}ms vs xerces ${mXerces.mean.toFixed(1)}ms) => Xerces is ${(mXmllint.mean / mXerces.mean).toFixed(1)}x faster`);
    console.log(`======================================================================\n`);
}

main().catch(console.error);