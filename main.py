from fastapi import FastAPI
from fastapi.responses import JSONResponse
from TikTokApi import TikTokApi
import os

app = FastAPI()

MS_TOKEN = os.getenv("TIKTOK_MS_TOKEN", "")

@app.get("/")
def home():
    return {"status": "ok"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/tiktok/user-videos")
async def get_videos(username: str, limit: int = 10):
    if not username:
        return JSONResponse(
            status_code=400,
            content={"ok": False, "error": "Missing username"}
        )

    if limit < 1:
        limit = 1
    if limit > 30:
        limit = 30

    api = None

    try:
        api = TikTokApi()

        # Khởi tạo Playwright browser
        await api.create_sessions(
            ms_tokens=[MS_TOKEN] if MS_TOKEN else None,
            num_sessions=1,
            sleep_after=3,
            browser="chromium",
            headless=True,
        )

        user = api.user(username=username)
        results = []

        async for video in user.videos(count=limit):
            try:
                data = video.as_dict
                stats = data.get("stats", {}) or {}

                video_id = data.get("id", "")
                results.append({
                    "username": username,
                    "video_id": video_id,
                    "desc": data.get("desc", ""),
                    "create_time": data.get("createTime", 0),
                    "views": stats.get("playCount", 0),
                    "likes": stats.get("diggCount", 0),
                    "comments": stats.get("commentCount", 0),
                    "shares": stats.get("shareCount", 0),
                    "saves": stats.get("collectCount", 0),
                    "url": f"https://www.tiktok.com/@{username}/video/{video_id}" if video_id else ""
                })
            except Exception as item_error:
                results.append({
                    "username": username,
                    "video_id": "",
                    "desc": "",
                    "create_time": 0,
                    "views": 0,
                    "likes": 0,
                    "comments": 0,
                    "shares": 0,
                    "saves": 0,
                    "url": "",
                    "item_error": str(item_error)
                })

        return {
            "ok": True,
            "count": len(results),
            "data": results
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": str(e),
                "username": username,
                "limit": limit
            }
        )

    finally:
        try:
            if api:
                await api.close_sessions()
        except Exception:
            pass
