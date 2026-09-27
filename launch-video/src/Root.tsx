import "./index.css";
import React from "react";
import { Composition, Folder } from "remotion";
import { LaunchVideo } from "./LaunchVideo";
import { BrandIntro } from "./scenes/BrandIntro";
import { Explainer } from "./scenes/Explainer";
import { EndRoll } from "./scenes/EndRoll";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LaunchVideo"
        component={LaunchVideo}
        durationInFrames={768}
        fps={30}
        width={1920}
        height={1080}
      />
      <Folder name="Scenes">
        <Composition
          id="BrandIntro"
          component={BrandIntro}
          durationInFrames={125}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Explainer"
          component={Explainer}
          durationInFrames={555}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="EndRoll"
          component={EndRoll}
          durationInFrames={118}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
    </>
  );
};
