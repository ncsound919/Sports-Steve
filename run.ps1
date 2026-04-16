# Sports Steve + Bet Buddy - Desktop Launcher
# Run both backend and frontend servers

Write-Host "🏈 Starting Sports Steve..." -ForegroundColor Cyan

# Start backend
Write-Host "  → Starting backend (FastAPI) on port 8010..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\Users\User\Desktop\Sports-Steve-main; python -m uvicorn src.main:app --port 8010 --reload" -WindowStyle Normal

# Wait for backend
Start-Sleep 3

# Start frontend
Write-Host "  → Starting frontend (Vite) on port 5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\Users\User\Desktop\Sports-Steve-main\frontend; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "✅ Servers starting!" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend: http://127.0.0.1:8010" -ForegroundColor White
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "Open http://localhost:5173 in your browser" -ForegroundColor Cyan
Write-Host "Press Ctrl+C in any window to stop" -ForegroundColor Gray
Read-Host