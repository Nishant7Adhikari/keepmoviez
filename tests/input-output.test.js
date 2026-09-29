const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sandbox = {
    console,
    Math,
    String,
    Number,
    Array,
    Object,
    parseFloat,
    parseInt,
    isNaN,
    encodeURIComponent,
    decodeURIComponent,
    generateUUID: () => '12345678-1234-4xxx-yxxx-123456789abc',
    document: {
        createElement: () => ({ click: () => {}, setAttribute: () => {} }),
        body: { appendChild: () => {}, removeChild: () => {} }
    },
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
    Blob: class Blob {}
};
sandbox.window = sandbox;

vm.createContext(sandbox);
const utilsCode = fs.readFileSync(path.join(__dirname, '../js/utils.js'), 'utf8');
vm.runInContext(utilsCode, sandbox);
const code = fs.readFileSync(path.join(__dirname, '../js/input-output.js'), 'utf8');
vm.runInContext(code, sandbox);

test('normalizeImportedRow handles standard fields cleanly', () => {
    const raw = {
        Name: ' Inception ',
        Year: '2010',
        Status: 'Watched',
        Category: 'Movie',
        overallRating: '5'
    };
    const normalized = sandbox.normalizeImportedRow(raw);
    assert.equal(normalized.Name, 'Inception');
    assert.equal(normalized.Year, '2010');
    assert.equal(normalized.Status, 'Watched');
    assert.equal(normalized.Category, 'Movie');
    assert.equal(normalized.overallRating, '5');
});

test('normalizeImportedRow handles missing/empty columns safely', () => {
    const raw = {};
    const normalized = sandbox.normalizeImportedRow(raw);
    assert.ok(normalized.id);
    assert.equal(normalized.Status, 'To Watch');
    assert.equal(normalized.Category, 'Movie');
});

test('normalizeImportedRow handles unknown field variations gracefully', () => {
    const raw = {
        title: ' Interstellar ',
        release_year: 2014,
        rating: 4,
        type: 'Film'
    };
    const normalized = sandbox.normalizeImportedRow(raw);
    assert.ok(normalized.id);
});

test('generateAndDownloadFile executes without crashing', () => {
    sandbox.movieData = [{ id: '1', Name: 'Matrix', Year: '1999', Status: 'Watched' }];
    assert.doesNotThrow(() => {
        sandbox.generateAndDownloadFile('json');
    });
});

test('populateImportSummary escapes HTML characters in smartImportState.fileName', async () => {
    let htmlContent = '';
    sandbox.document.getElementById = (id) => {
        if (id === 'importSummary') {
            return {
                set innerHTML(val) { htmlContent = val; },
                get innerHTML() { return htmlContent; }
            };
        }
        return null;
    };
    sandbox.movieData = [];
    sandbox.hideLoading = () => {};
    sandbox.$ = () => ({ modal: () => {}, off: () => ({ on: () => {} }) });
    await sandbox.initiateSmartImport([], '<img src="x" onerror="alert(1)">.csv');
    assert.ok(!htmlContent.includes('<img src="x" onerror="alert(1)">'));
    assert.ok(htmlContent.includes('&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;'));
});

test('index.html includes accessible info icon trigger for Smart Import Assistant', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    assert.ok(html.includes('id="smartImportModalLabel"'));
    assert.ok(html.includes('aria-label="Learn more about Smart Import Assistant"'));
    assert.ok(html.includes('title="Parses CSV/JSON backup files locally in browser memory and guides duplicate resolution. No file data is uploaded to remote servers."'));
});

test('index.html includes accessible info icon triggers and standard microcopy for Unwatchable entries and Orphaned Data Recovery', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    assert.ok(html.includes('aria-label="Learn more about Unwatchable status"'));
    assert.ok(html.includes('title="Unwatchable titles are excluded from statistics and recommendations while preventing duplicate additions."'));
    assert.ok(html.includes('View and manage titles marked with Unwatchable status.'));
    assert.ok(html.includes('aria-label="Learn more about Orphaned Data Recovery"'));
    assert.ok(html.includes('title="Scans local browser storage for unlinked data blocks from prior sessions or failed authentication states and exports them as a JSON file."'));
});

test('docs/index.html details Advanced Data Controls and recovery utilities', () => {
    const docsHtml = fs.readFileSync(path.join(__dirname, '../docs/index.html'), 'utf8');
    assert.ok(docsHtml.includes('Backfill Missing Data:'));
    assert.ok(docsHtml.includes('Manage Unwatchable Entries:'));
    assert.ok(docsHtml.includes('Check &amp; Repair Data:') || docsHtml.includes('Check & Repair Data:'));
    assert.ok(docsHtml.includes('Orphaned Data Recovery (Download Abandoned Data):'));
    assert.ok(docsHtml.includes('Erase All Data:'));
    assert.ok(docsHtml.includes('Batch Deletion Scopes:'));
});

test('index.html includes accessible info icon trigger for Batch Delete Scopes', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    assert.ok(html.includes('aria-label="Learn more about Batch Delete Scopes"'));
    assert.ok(html.includes('title="Deletion scope determines whether selected entries are purged from local browser cache, remote cloud database, or both locations."'));
});

test('index.html and docs/index.html include accessible info icon trigger and documentation for Batch Edit Operations', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    assert.ok(html.includes('id="batchEditModalLabel"'));
    assert.ok(html.includes('aria-label="Learn more about Batch Edit Operations"'));
    assert.ok(html.includes('title="Applies selective property updates across all selected collection entries. Unchecked fields are preserved without modification."'));

    const docsHtml = fs.readFileSync(path.join(__dirname, '../docs/index.html'), 'utf8');
    assert.ok(docsHtml.includes('Batch Field Editing &amp; Selective Property Updates:') || docsHtml.includes('Batch Field Editing & Selective Property Updates:'));
});

test('CSV export sanitizes formula triggers in string fields for full and batch export', () => {
    const appCode = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');

    let unparsedData = null;
    sandbox.Papa = {
        unparse: (data) => {
            unparsedData = data;
            return 'mock,csv';
        }
    };
    sandbox.showToast = () => {};
    sandbox.movieData = [
        {
            id: 'm1',
            Name: '=cmd|\' /C calc\'!A0',
            Description: '+12345',
            notes: '-danger',
            Category: '@admin',
            Status: '\tTabbed'
        }
    ];
    sandbox.selectedEntryIds = ['m1'];
    sandbox.isMultiSelectMode = true;

    // Test generateAndDownloadFile
    sandbox.generateAndDownloadFile('csv');
    assert.ok(unparsedData);
    assert.equal(unparsedData[0].Name, "'=cmd|' /C calc'!A0");
    assert.equal(unparsedData[0].Description, "'+12345");
    assert.equal(unparsedData[0].notes, "'-danger");
    assert.equal(unparsedData[0].Category, "'@admin");
    assert.equal(unparsedData[0].Status, "'\tTabbed");

    // Reset and test exportSelectedEntries
    unparsedData = null;
    vm.runInContext(appCode, sandbox);
    sandbox.exportSelectedEntries('csv');
    assert.ok(unparsedData);
    assert.equal(unparsedData[0].Name, "'=cmd|' /C calc'!A0");
    assert.equal(unparsedData[0].Description, "'+12345");
    assert.equal(unparsedData[0].notes, "'-danger");
    assert.equal(unparsedData[0].Category, "'@admin");
    assert.equal(unparsedData[0].Status, "'\tTabbed");
});

test('index.html includes refined microcopy and accessible info icons for Reload Local Data, Episodes per Season, and Franchise Linking', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    assert.ok(html.includes('Re-index local browser database cache'));
    assert.ok(html.includes('aria-label="Learn more about Reload Local Data"'));
    assert.ok(html.includes('aria-label="Learn more about Episodes per Season"'));
    assert.ok(html.includes('aria-label="Learn more about Link to Other Entries in Your Log"'));
});

test('docs/index.html details Local Browser Storage Cache Re-indexing and FAQ for Reload Local Data', () => {
    const docsHtml = fs.readFileSync(path.join(__dirname, '../docs/index.html'), 'utf8');
    assert.ok(docsHtml.includes('id="local-db-reload"'));
    assert.ok(docsHtml.includes('Local Browser Storage Cache Re-indexing'));
    assert.ok(docsHtml.includes('What does \'Reload Local Data\' do?'));
});
