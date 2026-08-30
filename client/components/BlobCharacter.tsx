"use client";

export function BlobCharacter({
  mood,
  color,
}: {
  mood: "happy" | "curious" | "calm" | "focused" | "done" | "cheeky" | "surprised" | "sleepy";
  color: string;
}) {
  const eyePositions =
    mood === "happy" ? { left: "26%", right: "62%", top: "36%" }
    : mood === "curious" ? { left: "24%", right: "60%", top: "40%" }
    : mood === "cheeky" ? { left: "26%", right: "62%", top: "36%" }
    : mood === "surprised" ? { left: "26%", right: "62%", top: "32%" }
    : mood === "sleepy" ? { left: "26%", right: "62%", top: "42%" }
    : { left: "26%", right: "62%", top: "38%" };

  return (
    <div className="relative w-48 h-44 mx-auto" aria-hidden="true">
      {/* Blob body */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: color,
          borderRadius:
            mood === "happy" ? "62% 38% 52% 48% / 55% 60% 40% 45%"
            : mood === "curious" ? "55% 45% 65% 35% / 50% 55% 45% 50%"
            : mood === "cheeky" ? "60% 40% 50% 50% / 55% 55% 45% 45%"
            : mood === "surprised" ? "50% 50% 50% 50% / 45% 45% 55% 55%"
            : mood === "sleepy" ? "60% 40% 60% 40% / 60% 60% 40% 40%"
            : "58% 42% 48% 52% / 52% 48% 52% 48%",
        }}
      />
      {/* Left eye white */}
      <div
        className="absolute w-11 h-11 bg-white rounded-full overflow-hidden"
        style={{ left: eyePositions.left, top: eyePositions.top, height: mood === "sleepy" ? "20px" : "44px" }}
      >
        {/* Pupil */}
        <div
          className="absolute w-5 h-5 bg-[#1a1a1a] rounded-full"
          style={{
            top: mood === "curious" ? "30%" : mood === "surprised" ? "25%" : mood === "sleepy" ? "10%" : "35%",
            left: mood === "curious" ? "40%" : mood === "cheeky" ? "20%" : "35%",
          }}
        />
        {mood === "cheeky" && (
           <div className="absolute top-0 w-full h-1/2 bg-[#1a1a1a] opacity-10" /> 
        )}
      </div>
      {/* Right eye white */}
      <div
        className="absolute w-11 h-11 bg-white rounded-full overflow-hidden"
        style={{ left: eyePositions.right, top: eyePositions.top, height: mood === "sleepy" ? "20px" : "44px" }}
      >
        <div
          className="absolute w-5 h-5 bg-[#1a1a1a] rounded-full"
          style={{
            top: mood === "curious" ? "30%" : mood === "surprised" ? "25%" : mood === "sleepy" ? "10%" : "35%",
            left: mood === "curious" ? "40%" : mood === "cheeky" ? "50%" : "35%",
          }}
        />
        {mood === "cheeky" && (
           <div className="absolute top-0 w-full h-1/2 bg-[#1a1a1a] opacity-10 transform -rotate-12" /> 
        )}
      </div>
      
      {/* Mouth */}
      {mood === "happy" && (
        <div
          className="absolute bg-white rounded-b-full"
          style={{ width: "46%", height: "22%", bottom: "18%", left: "27%" }}
        />
      )}
      {mood === "cheeky" && (
        <div
          className="absolute bg-white rounded-b-full"
          style={{ width: "24%", height: "16%", bottom: "22%", left: "38%", transform: "rotate(10deg)" }}
        />
      )}
      {mood === "surprised" && (
        <div
          className="absolute bg-white rounded-full"
          style={{ width: "22%", height: "24%", bottom: "16%", left: "39%" }}
        />
      )}
      {mood === "sleepy" && (
        <div
          className="absolute bg-white"
          style={{ width: "24%", height: "4%", bottom: "26%", left: "38%", borderRadius: "8px" }}
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
          style={{ width: "40%", height: "5%", bottom: "22%", left: "30%", borderRadius: "8px", transform: "rotate(5deg)" }}
        />
      )}
      {mood === "done" && (
        <div
          className="absolute bg-white rounded-b-full"
          style={{ width: "54%", height: "26%", bottom: "14%", left: "23%" }}
        />
      )}
    </div>
  );
}
