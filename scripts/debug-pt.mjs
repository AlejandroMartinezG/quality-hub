import fetch from 'node-fetch';
import Papa from 'papaparse';

const SHEET_PT_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFKJ54e57piNVk-IBmr3Ykl7-N4LN5QRwo7A83UmbAyF_oclIcQZSgc7QHid91hHb2N_SIi7lRcKZd/pub?output=csv";

async function debugCSV() {
    console.log(`Fetching CSV from: ${SHEET_PT_CSV_URL}`);
    const response = await fetch(SHEET_PT_CSV_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
    }
    const csvText = await response.text();

    console.log("\n--- CSV HEADERS ---");
    const firstLine = csvText.split('\n')[0];
    console.log(firstLine);

    const result = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
    });

    console.log("\n--- FIRST 5 ROWS ---");
    result.data.slice(0, 5).forEach((row, index) => {
        console.log(`\nRow ${index + 1}:`);
        console.log(row);
    });

    console.log(`\nTotal rows: ${result.data.length}`);
}

debugCSV().catch(console.error);
