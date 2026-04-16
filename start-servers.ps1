# Sports Steve - Start Both Servers (Background)
param(
    [int]$BackendPort = 8010,
    [int]$FrontendPort = 4000
)

$ErrorActionPreference = "Continue"
$ProjectRoot = "C:\Users\User\Desktop\Sports-Steve-main"
$FrontendRoot = "$ProjectRoot\frontend"

Write-Host "🏈 Starting Sports Steve..." -ForegroundColor Cyan

# Kill any existing processes on these ports
Get-NetTCPConnection -State Listen | Where-Object {$_.LocalPort -in $BackendPort, $FrontendPort} | ForEach-Object {
    $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "Stopping existing process on port $($_.LocalPort)" -ForegroundColor Gray
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep 2

# Start Backend in background
Write-Host "→ Starting backend on port $BackendPort..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $ProjectRoot; python -m uvicorn src.main:app --host 0.0.0.0 --port $BackendPort"
Start-Sleep 4

# Start Frontend in background  
Write-Host "→ Starting frontend on port $FrontendPort..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $FrontendRoot; npx vite --host 0.0.0.0 --port $FrontendPort"
Start-Sleep 4

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:$BackendPort" -ForegroundColor White
Write-Host "  Frontend: http://localhost:$FrontendPort" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Open http://localhost:$FrontendPort in your browser!" -ForegroundColor Cyan