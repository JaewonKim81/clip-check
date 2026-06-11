import React from "react";
import { Composition } from "remotion";
import { Intro, INTRO_DURATION, FPS } from "./Intro.jsx";

export const RemotionRoot = () => (
  <Composition
    id="ClipCheckIntro"
    component={Intro}
    durationInFrames={INTRO_DURATION}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
