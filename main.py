from fastapi import FastAPI
from TikTokApi import TikTokApi
import asyncio

app = FastAPI()

@app.get("/")
def home():
    return {"status": "ok"}

@app.get("/tiktok/user-videos")
async def get_videos(username: str, limit: int = 20):
    results = []

    async with TikTokApi() as api:
        user = api.user(username=username)

        count = 0
        async for video in user.videos(count=limit):
            data = video.as_dict
            stats = data.get("stats", {})

            results.append({
                "username": username,
                "video_id": data.get("id"),
                "desc": data.get("desc"),
                "views": stats.get("playCount", 0),
                "likes": stats.get("diggCount", 0),
                "comments": stats.get("commentCount", 0),
                "shares": stats.get("shareCount", 0),
                "saves": stats.get("collectCount", 0),
                "url": f"https://www.tiktok.com/@{username}/video/{data.get('id')}"
            })

            count += 1
            if count >= limit:
                break

    return results
