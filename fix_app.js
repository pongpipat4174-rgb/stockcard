const fs = require('fs');
const path = 'd:\\TANLAB\\Stockcard\\app.js';

try {
    let content = fs.readFileSync(path, 'utf8');

    const cleanFunction = `
// ฟังก์ชันสำหรับลบรายการ
async function deleteEntry(rowIndex) {
    if (!confirm(\`คุณแน่ใจหรือไม่ที่จะลบรายการในแถวที่ \${rowIndex}?\`)) {
        return;
    }

    try {
        if (typeof showToast === 'function') showToast('กำลังส่งคำขอลบรายการ...');
        
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', rowIndex: rowIndex })
        });

        setTimeout(async () => {
            if (typeof showToast === 'function') showToast('คำสั่งลบส่งเรียบร้อย');
            if (typeof init === 'function') await init(); 
            else location.reload();
        }, 2000);

    } catch (error) {
        console.error(error);
        alert('Error: ' + error.message);
    }
}
`;

    // Regex to find the broken block:
    // From end of saveEntry catch block to start of showAppsScriptSetupGuide
    // saveBtn.disabled = false; \n    } \n } ... broken ... function showAppsScriptSetupGuide

    // We look for "saveBtn.disabled = false;" then look for the closing brace of saveEntry function
    // The broken part starts after that.

    const startMarker = "saveBtn.disabled = false;";
    const endMarker = "function showAppsScriptSetupGuide";

    const startIndex = content.lastIndexOf(startMarker);
    const endIndex = content.indexOf(endMarker);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        // Find the actual end of saveEntry function (closing brace)
        // It's inside a catch block, so we need to find the closing brace of catch, then closing brace of function
        // Roughly, look for the first line starting with "}" after startMarker

        const prePart = content.substring(0, startIndex);
        const middlePart = content.substring(startIndex, endIndex);
        const postPart = content.substring(endIndex);

        // In middlePart, we expect:
        //     } catch ... } } [BROKEN CODE] 

        // Let's just replace the whole middle part carefully.
        // Actually, let's just find the broken part specifically by "if (!confirm"

        const brokenStart = content.indexOf("if (!confirm", startIndex);

        if (brokenStart !== -1 && brokenStart < endIndex) {
            // We found the broken if statement.
            // We want to replace from brokenStart (minus some previous garbage lines) up to endIndex

            // Look backwards from brokenStart to find the "}" of the previous function
            const previousFunctionEnd = content.lastIndexOf("}", brokenStart);

            if (previousFunctionEnd !== -1) {
                const part1 = content.substring(0, previousFunctionEnd + 1);
                const part3 = content.substring(endIndex);

                const newContent = part1 + "\n" + cleanFunction + "\n" + part3;
                fs.writeFileSync(path, newContent, 'utf8');
                console.log("Successfully fixed app.js using Node.js");
            } else {
                console.log("Could not find previous function end.");
            }
        } else {
            console.log("Could not find broken if statement.");
            // Fallback: Just insert before endMarker? No, that leaves garbage.
        }
    } else {
        console.log("Could not find markers.");
    }

} catch (e) {
    console.error(e);
}
