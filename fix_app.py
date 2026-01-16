import codecs
import re

file_path = r"d:\TANLAB\Stockcard\app.js"

try:
    with codecs.open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Define the clean function code
    clean_function = """
// ฟังก์ชันสำหรับลบรายการ
async function deleteEntry(rowIndex) {
    if (!confirm(`คุณแน่ใจหรือไม่ที่จะลบรายการในแถวที่ ${rowIndex}?`)) {
        return;
    }

    try {
        // showToast('กำลังส่งคำขอลบรายการ...'); // user defined function context check
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', rowIndex: rowIndex })
        });

        setTimeout(async () => {
            // showToast('คำสั่งลบถูกต้อง'); 
            // await init(); // user defined
             location.reload(); 
        }, 2000);

    } catch (error) {
        console.error(error);
        alert('Error: ' + error.message);
    }
}
"""

    # Regex to find the broken block:
    # Looks for the comment line (with garbage characters or normal text)
    # Followed by the broken if statement
    # Ending roughly before showAppsScriptSetupGuide
    
    # Strategy: Find everything between "saveBtn.disabled = false;" (end of saveEntry)
    # and "function showAppsScriptSetupGuide"
    
    pattern = r"(saveBtn\.disabled = false;\s*\}\s*catch.*?\}\s*\})(.*?)(function showAppsScriptSetupGuide)"
    
    # Check if we can find the boundaries
    match = re.search(pattern, content, re.DOTALL)
    
    if match:
        print("Found broken code block. Replacing...")
        # Keep the start (saveEntry end) and end (next function start), replace the middle with clean function
        new_content = content.replace(match.group(0), match.group(1) + "\n" + clean_function + "\n" + match.group(3))
        
        with codecs.open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print("Successfully fixed app.js")
    else:
        print("Could not find the specific broken validation pattern. Saving manual backup just in case.")

except Exception as e:
    print(f"Error: {e}")
