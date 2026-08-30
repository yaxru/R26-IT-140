"use client";

import { useEffect, useState } from "react";

// Reusable blob character — CSS only, no emoji
function BlobCharacter({
  mood,
  color,
}: {
  mood: "happy" | "curious" | "calm" | "focused" | "done";
  color: string; // slightly deeper shade than bg
}) {
  const eyePositions =
    mood === "happy"
      ? { left: "26%", right: "62%", top: "36%" }
      : mood === "curious"
      ? { left: "24%", right: "60%", top: "40%" }
      : { left: "26%", right: "62%", top: "38%" };

  return (
    <div className="relative w-48 h-44 mx-auto" aria-hidden="true">
      {/* Blob body */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: color,
          borderRadius:
            mood === "happy"
              ? "62% 38% 52% 48% / 55% 60% 40% 45%"
              : mood === "curious"
              ? "55% 45% 65% 35% / 50% 55% 45% 50%"
              : "58% 42% 48% 52% / 52% 48% 52% 48%",
        }}
      />
      {/* Left eye white */}
      <div
        className="absolute w-11 h-11 bg-white rounded-full"
        style={{ left: eyePositions.left, top: eyePositions.top }}
      >
        {/* Pupil */}
        <div
          className="absolute w-5 h-5 bg-[#1a1a1a] rounded-full"
          style={{
            top: mood === "curious" ? "30%" : "35%",
            left: mood === "curious" ? "40%" : "35%",
          }}
        />
      </div>
      {/* Right eye white */}
      <div
        className="absolute w-11 h-11 bg-white rounded-full"
        style={{ left: eyePositions.right, top: eyePositions.top }}
      >
        <div
          className="absolute w-5 h-5 bg-[#1a1a1a] rounded-full"
          style={{
            top: mood === "curious" ? "30%" : "35%",
            left: mood === "curious" ? "40%" : "35%",
          }}
        />
      </div>
      {/* Mouth */}
      {mood === "happy" && (
        <div
          className="absolute bg-white rounded-b-full"
          style={{
            width: "46%",
            height: "22%",
            bottom: "18%",
            left: "27%",
          }}
        />
      )}
      {mood === "curious" && (
        <div
          className="absolute bg-white rounded-full"
          style={{ width: "22%", height: "10%", bottom: "20%", left: "39%" }}
        />
      )}
      {mood === "calm" && (
        <div
          className="absolute bg-white"
          style={{ width: "36%", height: "5%", bottom: "22%", left: "32%", borderRadius: "8px" }}
        />
      )}
      {mood === "focused" && (
        <div
          className="absolute bg-white"
          style={{
            width: "40%",
            height: "5%",
            bottom: "22%",
            left: "30%",
            borderRadius: "8px",
            transform: "rotate(5deg)",
          }}
        />
      )}
      {mood === "done" && (
        <>
          {/* Happy wide mouth */}
          <div
            className="absolute bg-white rounded-b-full"
            style={{ width: "54%", height: "26%", bottom: "14%", left: "23%" }}
          />
        </>
      )}
    </div>
  );
}

export { BlobCharacter };
