@echo off
chcp 65001 > nul
echo ==========================================================
echo   StockCard - Unified Server Startup (PROD - Port 4001)
echo ==========================================================
echo.

cd /d "%~dp0database"

echo [1/2] ตรวจสอบ dependencies...
if not exist node_modules (
    echo   กำลังติดตั้ง packages... (ครั้งแรกอาจใช้เวลา ~30 วินาที)
    npm install
    echo   ติดตั้งสำเร็จ!
) else (
    echo   Dependencies พร้อมแล้ว
)
echo.

echo [2/2] เริ่ม Backend API Server (Port 4001)...
echo   URL: http://localhost:4001
echo   Health: http://localhost:4001/api/health
echo.
echo   Modules:
echo     📦 Package:      /api/package/data
echo     🧪 RM Center:    /api/rm/data?module=rm
echo     🏭 RM Production:/api/rm/data?module=rm_production
echo     🧹 Consumable:   /api/consumable/items
echo     ⚙️  GeneralStock: /api/items
echo.
echo   (กด Ctrl+C เพื่อหยุด Server)
echo ==========================================================

node server.js
