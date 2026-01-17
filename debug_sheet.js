const https = require('https');

const sheetId = '1h6--jU1VAjrNwHY1TcCfWn9En_gl464fvMaheNPxaTU';
const sheetName = encodeURIComponent('บันทึก StockCard');
const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${sheetName}&tq=SELECT%20*`;

console.log(`Fetching: ${url}`);

https.get(url, (res) => {
    console.log(`Status: ${res.statusCode}`);

    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log("Content Peek:");
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
