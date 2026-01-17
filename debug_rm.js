const https = require('https');

// RM Sheet ID
const sheetId = '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs';
// Note: Sheet1 is the default name usually
const sheetName = encodeURIComponent('Sheet1');
const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${sheetName}&tq=SELECT%20*`;

console.log(`Fetching RM: ${url}`);

https.get(url, (res) => {
    console.log(`Status: ${res.statusCode}`);

    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log("RM Content Peek:");
        console.log(data.substring(0, 500));

        if (data.includes('<!DOCTYPE html>') || data.includes('google.com/accounts')) {
            console.log("ERROR: Login Page Detected (Auth Required)");
        } else if (data.includes('google.visualization.Query.setResponse')) {
            console.log("SUCCESS: JSON Data received");
        } else {
            console.log("UNKNOWN: content format");
        }
    });

}).on('error', (err) => {
    console.log('Error: ' + err.message);
});
