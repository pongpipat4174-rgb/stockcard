@echo off
chcp 65001 > nul
echo ==========================================================
echo   StockCard - Unified Server (DEV Mode - Port 4002)
echo ==========================================================
echo   สิ่งที่เครื่องจะเห็นก่อน: เปิด http://localhost:4002
echo   (แก้โค้ดแล้ว refresh จะเห็นทันที)
echo   พอพร้อมแล้ว ค่อย deploy ลง PROD (port 4001)
echo ==========================================================
echo.

cd /d "%~dp0database"

echo [1/2] ตรวจสอบ dependencies...
if not exist node_modules (
    echo   กำลังติดตั้ง packages...
    npm install
) else (
    echo   Dependencies พร้อมแล้ว
)
echo.

echo [2/2] เริ่ม Backend API Server (Port 4002 - DEV)...
set PORT=4002
echo   URL: http://localhost:4002
echo   (กด Ctrl+C เพื่อหยุด Server)
echo ==========================================================

node server.js
