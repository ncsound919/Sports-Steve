@echo off
echo Starting Sports Steve + Bet Buddy...
echo.

echo Starting backend on port 8010...
start "Backend" cmd /k "cd /d C:\Users\User\Desktop\Sports-Steve-main && python -m uvicorn src.main:app --port 8010 --reload"

timeout /t 3 /nobreak >nul

echo Starting frontend on port 5173...
start "Frontend" cmd /k "cd /d C:\Users\User\Desktop\Sports-Steve-main\frontend && npm run dev"

timeout /t 5 /nobreak >nul

echo.
echo ===================
echo Servers starting:
echo   Backend: http://127.0.0.1:8010
echo   Frontend: http://localhost:5173
echo.
echo Open http://localhost:5173 in your browser
echo ===================
echo.
pause