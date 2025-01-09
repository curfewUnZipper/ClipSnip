import path from "path";
import fs from "fs";
import { NextResponse } from "next/server";
import ytdl from "ytdl-core";
import ffmpeg from "fluent-ffmpeg";

const clipsDirectory = path.join(process.cwd(), "public", "downloads");

if (!fs.existsSync(clipsDirectory)) {
  fs.mkdirSync(clipsDirectory, { recursive: true });
}

export async function POST(req: Request) {
  const { youtubeLink, startTime, duration } = await req.json();

  if (!youtubeLink || !startTime || !duration) {
    return NextResponse.json(
      { error: "YouTube link, start time, and duration are required" },
      { status: 400 }
    );
  }

  try {
    const videoId = ytdl.getURLVideoID(youtubeLink);
    const videoPath = path.join(clipsDirectory, `${videoId}.mp4`);
    const clipPath = path.join(
      clipsDirectory,
      `${videoId}_clip_${startTime.replace(/:/g, "-")}_${duration}.mp4`
    );

    // Download the video using ytdl-core
    const videoStream = ytdl(youtubeLink, { quality: "highestvideo" });
    const videoFile = fs.createWriteStream(videoPath);

    await new Promise((resolve, reject) => {
      videoStream.pipe(videoFile);
      videoStream.on("end", resolve);
      videoStream.on("error", reject);
    });

    // Extract the clip using fluent-ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .output(clipPath)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    // Return the clip URL
    return NextResponse.json({
      message: "Clip generated successfully",
      clipUrl: `/downloads/${path.basename(clipPath)}`,
    });
  } catch (error) {
    console.error("Error generating clip:", error);
    return NextResponse.json(
      { error: "Failed to process the video" },
      { status: 500 }
    );
  }
}
