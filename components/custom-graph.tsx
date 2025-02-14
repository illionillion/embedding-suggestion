"use client";

import RobotAnimation from "@/components/robot-animation";
import { getSuggestions } from "@/actions/suggestion";
import { Center, FC } from "@yamada-ui/react";
import { useEffect, useRef } from "react";
import { ForceGraph2D } from "react-force-graph";

interface ForceGraphMethods {
    d3Force: (force: string) => {
        strength: (value: number) => void;
        distance?: (value: (link: Link) => number) => void;
    } | undefined;
}

interface Node {
    id: string;
    label?: string;
    name?: string;
    x?: number;
    y?: number;
    __bckgDimensions?: [number, number];
}

interface Link {
    source: string;
    target: string;
    value: number;
}

interface CustomGraphProps {
    query: string
    data: Awaited<ReturnType<typeof getSuggestions>>
    loading: boolean
}

const CustomGraph: FC<CustomGraphProps> = ({
    query,
    data,
    loading,
}) => {
    const graphRef = useRef<ForceGraphMethods | null>(null); // 型を追加
    const imageRef = useRef<HTMLImageElement | null>(null);
    const zoomLevelRef = useRef(1)
    // onZoomハンドラ内ではuseRefの値を更新する
    const handleZoom = (event: { k: number }) => {
        zoomLevelRef.current = event.k
    }
    useEffect(() => {
        const image = new Image();
        image.src = "https://user0514.cdnw.net/shared/img/thumb/21830aIMGL99841974_TP_V.jpg";
        imageRef.current = image;
    }, [])

    useEffect(() => {
        if (graphRef.current) {
            graphRef.current?.d3Force("charge")?.strength(-100); // ノード間の距離を広げる

            graphRef.current?.d3Force("link")?.distance?.((link) => {
                const isKeywordLink = (link.source as unknown as { name: string }).name === query || (link.target as unknown as { name: string }).name === query;
                if (isKeywordLink) {
                    // キーワードノードとのリンクは距離を縮める
                    return 100;  // キーワードノードとの距離を近づける
                }

                // その他のリンクは元の距離を維持
                return (1 - link.value) * 700;  // 類似度に応じて距離を調整
            });
        }
    }, [data, query]);

    return (
        <Center w="full" h="full" position="relative">
            {loading && (
                <Center
                    position="absolute"
                    zIndex="beerus"
                    rounded="full"
                    boxSize="md"
                    bg="blackAlpha.100"
                >
                    <RobotAnimation />
                </Center>
            )}
            <ForceGraph2D
                ref={graphRef as any}
                onZoom={handleZoom}
                graphData={data}
                nodeLabel={(node: Node) => node.label || ""}
                nodeAutoColorBy="id"
                linkWidth={(link: Link) => link.value * 10}
                linkDirectionalArrowLength={6}
                linkDirectionalArrowRelPos={1}
                linkDirectionalArrowColor={(link: Link) => link.value > 0.7 ? 'red' : 'blue'}
                nodeCanvasObject={(node: Node, ctx) => {
                    const scale = zoomLevelRef.current
                    const label = Array.from(node.label || "")
                        .filter((_, i) => i <= (node.id === "query" ? 7 : 9))
                        .join("")
                    const fontSize = 16 / scale
                    ctx.font = `${fontSize}px Sans-Serif`
                    const textHeight =
                        ctx.measureText(label).actualBoundingBoxAscent +
                        ctx.measureText(label).actualBoundingBoxDescent
                    const cardWidth = 180 / scale
                    const image = imageRef.current;
                    const cardHeight = 100 / scale

                    const totalCardHeight = cardHeight + textHeight + fontSize * 2

                    if (node.id === "query") {
                        ctx.shadowColor = "rgba(0, 0, 0, 0.3)"
                        ctx.shadowBlur = 10
                        ctx.shadowOffsetX = 0
                        ctx.shadowOffsetY = 2
                        const radius = 75 / scale
                        ctx.beginPath()
                        ctx.arc(node.x || 0, node.y || 0, radius, 0, 2 * Math.PI, false)
                        ctx.fillStyle = "#5cc0db"
                        ctx.fill()
                        ctx.fillStyle = "white"
                        ctx.textAlign = "center"
                        ctx.textBaseline = "middle"
                        ctx.fillText(
                            label.length > 7 ? label.concat("...") : label,
                            node.x || 0,
                            node.y || 0,
                        )
                        node.__bckgDimensions = [radius * 2, radius * 2]
                        ctx.shadowColor = "transparent"
                        ctx.shadowBlur = 0
                        ctx.shadowOffsetX = 0
                        ctx.shadowOffsetY = 0
                    } else {
                        ctx.shadowColor = "rgba(0, 0, 0, 0.3)"
                        ctx.shadowBlur = 10
                        ctx.shadowOffsetX = 0
                        ctx.shadowOffsetY = 5

                        ctx.fillStyle = image ? "white" : "lightgray" // 画像がない場合に薄いグレーを使用
                        ctx.fillRect(
                            (node.x || 0) - cardWidth / 2,
                            (node.y || 0) - totalCardHeight / 2,
                            cardWidth,
                            totalCardHeight,
                        )

                        ctx.shadowColor = "transparent"
                        ctx.shadowBlur = 0
                        ctx.shadowOffsetX = 0
                        ctx.shadowOffsetY = 0

                        if (image) {
                            const imgAspect = image.width / image.height
                            const cardAspect = cardWidth / cardHeight

                            let sx = 0,
                                sy = 0,
                                sWidth = image.width,
                                sHeight = image.height

                            if (imgAspect > cardAspect) {
                                // 画像が横長 → 横をトリミング
                                sWidth = image.height * cardAspect
                                sx = (image.width - sWidth) / 2
                            } else {
                                // 画像が縦長 → 縦をトリミング
                                sHeight = image.width / cardAspect
                                sy = (image.height - sHeight) / 2
                            }

                            ctx.drawImage(
                                image, // 画像ソース
                                sx,
                                sy,
                                sWidth,
                                sHeight, // トリミングする範囲
                                (node.x || 0) - cardWidth / 2, // 描画位置
                                (node.y || 0) - totalCardHeight / 2,
                                cardWidth,
                                cardHeight, // 描画サイズ
                            )
                        } else {
                            const labelBackgroundY =
                                (node.y || 0) + cardHeight / 2 - textHeight / 2 - fontSize
                            ctx.fillStyle = "white"
                            ctx.shadowColor = "rgba(0, 0, 0, 0.2)"
                            ctx.shadowBlur = 6
                            ctx.shadowOffsetY = 5
                            ctx.fillRect(
                                (node.x || 0) - cardWidth / 2,
                                labelBackgroundY,
                                cardWidth,
                                textHeight + fontSize * 2,
                            )
                            ctx.shadowColor = "transparent"
                            ctx.shadowBlur = 0
                            ctx.shadowOffsetX = 0
                            ctx.shadowOffsetY = 0
                            ctx.shadowOffsetY = 0
                        }

                        ctx.fillStyle = "black"
                        ctx.textAlign = "center"
                        ctx.textBaseline = "middle"
                        ctx.fillText(
                            label.length > 9 ? label.concat("...") : label,
                            node.x || 0,
                            (node.y || 0) + cardHeight / 2,
                        )
                        node.__bckgDimensions = [cardWidth, totalCardHeight]
                    }
                }}
                nodePointerAreaPaint={(node: Node, color, ctx) => {
                    const bckgDimensions = node.__bckgDimensions
                    if (bckgDimensions) {
                        ctx.fillStyle = color
                        ctx.fillRect(
                            (node.x || 0) - bckgDimensions[0] / 2,
                            (node.y || 0) - bckgDimensions[1] / 2,
                            ...bckgDimensions,
                        )
                    }
                }}
                onNodeClick={(node, e) => {
                    if (node.id === "query") {
                        return;
                    }
                    // ノードをクリックした際の遷移処理
                    console.log(node, e);
                }}
            />
        </Center>
    );
}

export default CustomGraph;