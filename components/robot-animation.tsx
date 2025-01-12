"use client"
import RobotAnimationJson from "@/public/robot-animation.json"
import { useEffect, useRef } from "react";
import { ui } from "@yamada-ui/react";

export default function RobotAnimation() {

    let animationRef = useRef<HTMLDivElement | null>(null);

    async function getLottie() {
        const lot = await import("lottie-web");

        // ダブらないようにchildNodesが0の時だけロード
        if (animationRef.current && animationRef.current.childNodes.length === 0) {
            console.log("load animation", animationRef.current.childNodes.length === 0);
            lot.default.loadAnimation({
                autoplay: true,
                loop: true,
                animationData: RobotAnimationJson,
                container: animationRef.current
            })
        }

    }
    useEffect(() => {
        getLottie();
    }, []);


    return (
        <ui.div
            pointerEvents="none"
            height="250px"
            width="250px"
            ref={animationRef}></ui.div>
    );

}