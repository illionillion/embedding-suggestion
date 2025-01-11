"use client";

import { getSuggestions } from "@/actions/suggestion";
import { ForceGraph2D } from "react-force-graph";
import { Button, Center, Container, Heading, HStack, Input, Loading, useBoolean, } from "@yamada-ui/react";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";

// 手動で ForceGraphMethods 型を定義
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

export default function Home() {
  const DynamicForceGraph2D = dynamic(() => import('react-force-graph').then(mod => mod.ForceGraph2D), {
    ssr: false,
    loading: () => <Center w="full" h="full">
      <Loading />
    </Center>
  }) as typeof ForceGraph2D;

  const graphRef = useRef<ForceGraphMethods | null>(null); // 型を追加
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [query, setQuery] = useState("");
  const cacheRef = useRef(new Map<string, Awaited<ReturnType<typeof getSuggestions>>>());
  const [data, setData] = useState<Awaited<ReturnType<typeof getSuggestions>>>({ nodes: [], links: [] });
  const [isLoading, { on: start, off: end }] = useBoolean();

  const handleSearch = async () => {
    const cache = cacheRef.current;
    if (!query) return;
    start();
    console.log("query", query);
    const result = cache.has(query) ? cache.get(query) : await getSuggestions(query);
    console.log(result);
    if (result) {
      cache.set(query, result);
      setData(result);
    }
    end();
  };

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current?.d3Force("charge")?.strength(-5000); // ノード間の距離を広げる
      graphRef.current?.d3Force("link")?.distance?.((link) => {
        // 類似度が高いほど距離を短く、低いほど距離を長く
        return (1 - link.value) * 300;  // 類似度に応じて距離を調整（距離が広がるほど類似度が低い）
      });
    }
  }, [data]);

  useEffect(() => {
    const image = new Image();
    image.src = "https://user0514.cdnw.net/shared/img/thumb/21830aIMGL99841974_TP_V.jpg";
    imageRef.current = image;
  }, [])

  return (
    <Container w="full" h="100dvh" m="auto">
      <Heading>検索</Heading>
      <HStack>
        <Input
          type="text"
          placeholder="キーワード入力"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          disabled={isLoading}
        />
        <Button onClick={handleSearch} loading={isLoading}>
          検索
        </Button>
      </HStack>
      <DynamicForceGraph2D
        ref={graphRef as any}
        graphData={data}
        nodeLabel={(node: Node) => node.label || ""}
        nodeAutoColorBy="id"
        linkWidth={(link: Link) => link.value * 10}
        linkDirectionalArrowLength={6}
        linkDirectionalArrowRelPos={1}
        linkDirectionalArrowColor={(link: Link) => link.value > 0.7 ? 'red' : 'blue'}

        nodeCanvasObject={(node, ctx, globalScale) => {
          const label = node.label || "";
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;

          // ラベルの文字幅を計算
          const textWidth = ctx.measureText(label).width;
          const textHeight = ctx.measureText(label).actualBoundingBoxAscent + ctx.measureText(label).actualBoundingBoxDescent;
          const cardWidth = Math.max(60, textWidth + 20); // 最小幅を60pxに設定、余白20px

          // 各ノードの位置を少しずつ調整
          // if (node.x && node.y) {
          //   node.x += Math.random() * 50 - 25;  // ランダムに少しずらして間隔を広げる
          //   node.y += Math.random() * 50 - 25;  // ランダムに少しずらして間隔を広げる
          // }

          const image = imageRef.current;

          // カードの高さを画像のアスペクト比を保ちながら調整
          let cardHeight = 0;

          if (image) {
            const imageAspectRatio = image.width / image.height; // 画像のアスペクト比
            cardHeight = cardWidth / imageAspectRatio;  // 横幅に合わせた高さに設定
          }

          // ラベルと説明をカードに含める
          const totalCardHeight = cardHeight + textHeight + fontSize * 2; // 画像 + ラベル + 説明部分

          if (node.label === query) {
            // キーワードノードの描画
            const radius = 20;
            ctx.beginPath();
            ctx.arc(node.x || 0, node.y || 0, radius, 0, 2 * Math.PI, false);
            ctx.fillStyle = "rgba(0, 255, 0, 0.8)"; // 円の色
            ctx.fill();
            ctx.fillStyle = "black";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, node.x || 0, node.y || 0);

            // バックグラウンドの寸法を円に合わせて設定
            node.__bckgDimensions = [radius * 2, radius * 2];  // 円の直径
          } else if (image) {
            // サークルノードの描画 (背景を白に設定)
            ctx.fillStyle = "white";  // 背景を白に設定
            ctx.fillRect((node.x || 0) - cardWidth / 2, (node.y || 0) - totalCardHeight / 2, cardWidth, totalCardHeight);
          
            // 画像をカード内に収める（画像の上部をカードの上部に合わせる）
            ctx.drawImage(image, (node.x || 0) - cardWidth / 2, (node.y || 0) - totalCardHeight / 2, cardWidth, cardHeight);
          
            // サークル名（ラベル）を画像の下に描画
            ctx.fillStyle = "black";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, node.x || 0, (node.y || 0) + cardHeight / 2);
          
            // バックグラウンドの寸法を再設定
            node.__bckgDimensions = [cardWidth, totalCardHeight];  // 高さをラベルと説明まで含めて設定
          }          
        }}

        nodePointerAreaPaint={(node: Node, color, ctx) => {
          const bckgDimensions = node.__bckgDimensions;
          if (bckgDimensions) {
            ctx.fillStyle = color;
            ctx.fillRect(
              (node.x || 0) - bckgDimensions[0] / 2,
              (node.y || 0) - bckgDimensions[1] / 2,
              ...bckgDimensions
            );
          }
        }}

        onNodeClick={(node, e) => {
          if (node.id === "query") {
            return
          }
          // ノードをクリックした際の遷移処理
          console.log(node, e);
        }}
      />
    </Container>
  );
}