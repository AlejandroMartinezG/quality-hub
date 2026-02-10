import fetch from 'node-fetch';

const URLS = [
    { name: "MP (Original)", url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFKJ54e57piNVk-IBmr3Ykl7-N4LN5QRwo7A83UmbAyF_oclIcQZSgc7QHid91hHb2N_SIi7lRcKZd/pub?output=csv" },
    { name: "MP (GID 0)", url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFKJ54e57piNVk-IBmr3Ykl7-N4LN5QRwo7A83UmbAyF_oclIcQZSgc7QHid91hHb2N_SIi7lRcKZd/pub?gid=0&single=true&output=csv" },
    { name: "MP (GID 1344191871)", url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFKJ54e57piNVk-IBmr3Ykl7-N4LN5QRwo7A83UmbAyF_oclIcQZSgc7QHid91hHb2N_SIi7lRcKZd/pub?gid=1344191871&single=true&output=csv" },
    { name: "PT (GID 1911772609)", url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFKJ54e57piNVk-IBmr3Ykl7-N4LN5QRwo7A83UmbAyF_oclIcQZSgc7QHid91hHb2N_SIi7lRcKZd/pub?gid=1911772609&single=true&output=csv" }
];

async function checkUrl(item) {
    try {
        console.log(`Checking ${item.name}...`);
        const response = await fetch(item.url);
        if (response.ok) {
            const text = await response.text();
            const firstLine = text.split('\n')[0];
            console.log(`✅ OK: ${item.name}`);
            console.log(`   Headers: ${firstLine.substring(0, 100)}...`);
        } else {
            console.log(`❌ FAILED: ${item.name} - Status: ${response.status}`);
        }
    } catch (error) {
        console.log(`❌ ERROR: ${item.name} - ${error.message}`);
    }
    console.log('---');
}

async function main() {
    for (const item of URLS) {
        await checkUrl(item);
    }
}

main();
