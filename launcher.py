"""Sports Steve Desktop Launcher.

Starts the FastAPI backend and opens the frontend in the default browser.
"""
import os
import sys
import time
import webbrowser
import threading
import uvicorn


def open_browser(port: int = 8010, delay: float = 2.0):
    """Open browser after a short delay to let the server start."""
    time.sleep(delay)
    webbrowser.open(f"http://localhost:{port}")


def main():
    # Serve the built frontend from the FastAPI app
    os.environ.setdefault("SPORTS_STEVE_STATIC_DIR", 
        os.path.join(os.path.dirname(__file__), "frontend", "dist"))
    
    port = int(os.environ.get("PORT", "8010"))
    
    # Open browser in background thread
    threading.Thread(target=open_browser, args=(port,), daemon=True).start()
    
    # Start uvicorn
    uvicorn.run(
        "src.main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
