import asyncio
from TikTokApi import TikTokApi

async def main():
    async with TikTokApi() as api:
        user = api.user(username="username_here")

        videos = []
        async for video in user.videos(count=50):
            stats = video.stats
            videos.append({
                "id": video.id,
                "views": stats.play_count,
                "likes": stats.digg_count,
                "comments": stats.comment_count,
                "shares": stats.share_count
            })

        # sort theo độ viral
        videos_sorted = sorted(
            videos,
            key=lambda x: (x["likes"] + x["comments"]*2 + x["shares"]*3),
            reverse=True
        )

        top_30 = videos_sorted[:30]

        for v in top_30:
            print(v)

asyncio.run(main())
